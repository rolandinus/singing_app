import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';
import { midiToScientific } from '../../core/utils/note-helpers';
import { autoCorrelate, noteFromPitch } from '../../core/utils/pitch';

// @siteed/expo-audio-studio is used for real-time PCM streaming on native (iOS/Android).
// It is not imported on web — the AnalyserNode path is used there instead.
//
// IMPORTANT: The native ExpoAudioStream module delivers audio data via EventEmitter
// ('AudioData' and 'AudioAnalysis' events), NOT via callbacks in startRecording options.
// The useAudioRecorder hook strips onAudioStream/onAudioAnalysis before calling native
// startRecording and sets up event listeners separately. We replicate that pattern here.
let studioStartRecording: ((options: StudioRecordingOptions) => Promise<StudioStartRecordingResult>) | null = null;
let studioStopRecording: (() => Promise<StudioRecordingResult | null>) | null = null;
let studioConvertPCMToFloat32: ((data: string, bitDepth: number) => Float32Array) | null = null;
let studioExtractAudioAnalysis: ((options: StudioExtractAudioAnalysisOptions) => Promise<StudioAudioAnalysis>) | null = null;
let studioAddAudioDataListener: ((cb: (event: StudioAudioDataEvent) => void) => { remove: () => void }) | null = null;
let studioAddAudioAnalysisListener: ((cb: (event: StudioAudioAnalysisEvent) => void) => { remove: () => void }) | null = null;

if (Platform.OS !== 'web') {
  // Dynamic require to avoid bundling on web where the native module is unavailable.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const studio = require('@siteed/expo-audio-studio') as {
    ExpoAudioStreamModule?: object;
    startRecording?: (options: StudioRecordingOptions) => Promise<StudioStartRecordingResult>;
    stopRecording?: () => Promise<StudioRecordingResult | null>;
    convertPCMToFloat32: (data: string, bitDepth: number) => Float32Array;
    extractAudioAnalysis?: (options: StudioExtractAudioAnalysisOptions) => Promise<StudioAudioAnalysis>;
  };
  const nativeModule = (studio.ExpoAudioStreamModule ?? studio) as Record<string, unknown> | undefined;
  if (nativeModule) {
    studioStartRecording = (nativeModule.startRecording as typeof studioStartRecording) ?? null;
    studioStopRecording = (nativeModule.stopRecording as typeof studioStopRecording) ?? null;

    // Set up EventEmitter-based listeners using expo-modules-core's LegacyEventEmitter.
    // Audio data (PCM) and audio analysis events arrive via the module's event system,
    // not via callbacks embedded in startRecording options.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { LegacyEventEmitter } = require('expo-modules-core') as {
        LegacyEventEmitter: new (module: object) => {
          addListener<T>(event: string, cb: (e: T) => void): { remove: () => void };
        };
      };
      const emitter = new LegacyEventEmitter(nativeModule as object);
      studioAddAudioDataListener = (cb) => emitter.addListener<StudioAudioDataEvent>('AudioData', cb);
      studioAddAudioAnalysisListener = (cb) => emitter.addListener<StudioAudioAnalysisEvent>('AudioAnalysis', cb);
    } catch {
      // expo-modules-core not available — fallback listeners stay null
    }
  }
  studioConvertPCMToFloat32 = studio.convertPCMToFloat32;
  studioExtractAudioAnalysis = studio.extractAudioAnalysis
    ?? (nativeModule?.extractAudioAnalysis as typeof studioExtractAudioAnalysis)
    ?? null;
}

interface StudioStartRecordingResult {
  fileUri?: string;
}

interface StudioRecordingResult {
  fileUri?: string;
  size?: number;
  durationMs?: number;
  mimeType?: string;
}

// Payload delivered by the 'AudioData' native event (matches AudioEventPayload from the library).
interface StudioAudioDataEvent {
  encoded?: string;
  buffer?: Float32Array;
  deltaSize?: number;
  [key: string]: unknown;
}

// Payload delivered by the 'AudioAnalysis' native event (matches AudioAnalysis from the library).
interface StudioAudioDataPoint {
  startTime?: number;
  endTime?: number;
  features?: { pitch?: number };
  pitch?: number;
  pitchDetection?: {
    pitch?: number;
  };
}
interface StudioAudioAnalysisEvent {
  segmentDurationMs?: number;
  dataPoints?: StudioAudioDataPoint[];
  points?: StudioAudioDataPoint[];
  [key: string]: unknown;
}

interface StudioAudioAnalysis {
  segmentDurationMs: number;
  dataPoints?: StudioAudioDataPoint[];
  points?: StudioAudioDataPoint[];
}

interface StudioExtractAudioAnalysisOptions {
  fileUri: string;
  segmentDurationMs?: number;
  features?: {
    pitch?: boolean;
  };
}

// Options passed directly to the native startRecording — no function callbacks.
// Audio data arrives via EventEmitter events ('AudioData', 'AudioAnalysis').
interface StudioRecordingOptions {
  sampleRate: number;
  encoding: 'pcm_16bit' | 'pcm_32bit';
  channels: number;
  interval: number;
  intervalAnalysis?: number;
  enableProcessing?: boolean;
  features?: { pitch?: boolean };
  output?: {
    primary?: {
      enabled?: boolean;
      format?: 'wav';
    };
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function readStudioDataPoints(analysis: { dataPoints?: StudioAudioDataPoint[]; points?: StudioAudioDataPoint[] }): StudioAudioDataPoint[] {
  if (Array.isArray(analysis.dataPoints) && analysis.dataPoints.length > 0) return analysis.dataPoints;
  if (Array.isArray(analysis.points) && analysis.points.length > 0) return analysis.points;
  return [];
}

function readStudioPitchHz(point: StudioAudioDataPoint): number | null {
  const value = Number(
    point.features?.pitch
    ?? point.pitch
    ?? point.pitchDetection?.pitch
    ?? 0,
  );
  if (!Number.isFinite(value)) return null;
  return value;
}

function normalizeStudioTimeMs(timeValue: number | undefined, fallbackTimeMs: number): number {
  if (!Number.isFinite(timeValue)) return fallbackTimeMs;
  const value = Number(timeValue);
  if (value <= 0) return 0;

  // expo-audio-studio emits DataPoint.startTime/endTime in seconds (native + web).
  // Convert to ms for the rest of the singing pipeline.
  if (value < 30) {
    return value * 1000;
  }

  return value;
}

type PitchTimelinePoint = { timeMs: number; frequency: number };
type DetectorSource = 'autocorrelation' | 'studio_pitch';

export type PitchCaptureDebugSnapshot = {
  phase: 'idle' | 'request_permission' | 'recording' | 'recorded' | 'analyzing' | 'analysis_sample' | 'analysis_complete' | 'error';
  timestampMs: number;
  detector?: DetectorSource;
  isRecording?: boolean;
  durationMillis?: number;
  metering?: number | null;
  frequency?: number | null;
  sampleTimeMs?: number;
  timelinePoints?: number;
  uri?: string | null;
  message?: string;
};
type PitchCaptureDebugListener = ((snapshot: PitchCaptureDebugSnapshot) => void) | null;

export class ExpoPitchCapturePort {
  /** True while a native streaming session is active. */
  private nativeStreaming = false;
  private debugListener: PitchCaptureDebugListener = null;

  setDebugListener(listener: PitchCaptureDebugListener): void {
    this.debugListener = listener;
    if (listener) {
      this.emitDebug({ phase: 'idle', message: 'listener_attached' });
    }
  }

  private emitDebug(snapshot: Omit<PitchCaptureDebugSnapshot, 'timestampMs'>): void {
    if (!this.debugListener) return;
    try {
      console.log({ ...snapshot,
        timestampMs: Date.now(),})
      this.debugListener({
        ...snapshot,
        timestampMs: Date.now(),
      });
    } catch {}
  }

  private async ensurePermissions() {
    this.emitDebug({ phase: 'request_permission', message: 'checking_permissions' });
    const existing = await getRecordingPermissionsAsync();
    if (!existing.granted) {
      const requested = await requestRecordingPermissionsAsync();
      if (!requested.granted) {
        this.emitDebug({ phase: 'error', message: 'microphone_permission_denied' });
        throw new Error('Mikrofonberechtigung wurde nicht erteilt.');
      }
    }
    this.emitDebug({ phase: 'request_permission', message: 'permission_granted' });
  }

  /**
   * Ensure microphone permission has been granted before a singing capture flow starts.
   * On web this triggers getUserMedia once and immediately closes the stream.
   */
  async ensureMicrophonePermission(): Promise<void> {
    if (Platform.OS === 'web') {
      this.emitDebug({ phase: 'request_permission', message: 'checking_permissions' });
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks()) {
          track.stop();
        }
      } catch {
        this.emitDebug({ phase: 'error', message: 'microphone_permission_denied' });
        throw new Error('Mikrofonberechtigung wurde nicht erteilt.');
      }
      this.emitDebug({ phase: 'request_permission', message: 'permission_granted' });
      return;
    }

    await this.ensurePermissions();
  }

  private async configureAudioModeForRecording() {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });
  }

  // ---------------------------------------------------------------------------
  // Native real-time streaming path
  // ---------------------------------------------------------------------------

  /**
   * Streams PCM from the microphone in real time using @siteed/expo-audio-studio,
   * collecting pitch samples for `durationMs` milliseconds.
   *
   * Audio data arrives via EventEmitter events — NOT via callbacks in startRecording options
   * (the native module ignores function callbacks in options; the useAudioRecorder hook sets
   * up listeners separately, and we replicate that pattern here).
   *
   * Studio pitch is collected from real-time 'AudioAnalysis' events (requires the native
   * module to support features.pitch). If no real-time pitch data is collected, falls back
   * to a post-recording extractAudioAnalysis pass over the saved WAV file.
   */
  private async streamPitchNative(
    durationMs: number,
    comparisonSegmentMs = 100,
  ): Promise<{
    timeline: PitchTimelinePoint[];
    studioPitchTimeline: PitchTimelinePoint[];
  }> {
    if (!studioStartRecording || !studioStopRecording || !studioConvertPCMToFloat32) {
      throw new Error('Native audio studio module is not available.');
    }

    await this.stop();
    await this.ensurePermissions();
    await this.configureAudioModeForRecording();

    const timeline: PitchTimelinePoint[] = [];
    const studioPitchRealtimeTimeline: PitchTimelinePoint[] = [];
    let startedAt: number | null = null;
    const convertPCM = studioConvertPCMToFloat32;
    let startRecordingResult: StudioStartRecordingResult | null = null;

    this.nativeStreaming = true;

    // Set up event listeners BEFORE starting recording so no events are missed.
    const audioDataSub = studioAddAudioDataListener?.((event: StudioAudioDataEvent) => {
      if (!this.nativeStreaming || startedAt == null) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= durationMs) return;

      // Native delivers PCM as base64 string in `encoded`; web delivers Float32Array in `buffer`.
      const raw = event.encoded ?? event.buffer;
      if (!raw) return;
      if ((event.deltaSize ?? 1) === 0) return;

      let pcm: Float32Array;
      if (typeof raw === 'string') {
        try {
          pcm = convertPCM(raw, 16);
        } catch {
          return;
        }
      } else {
        pcm = raw;
      }

      if (pcm.length < 256) return;

      const freq = autoCorrelate(pcm, 44100);
      if (!Number.isFinite(freq) || freq < 60 || freq > 1200) return;

      timeline.push({ timeMs: elapsed, frequency: freq });
      this.emitDebug({
        phase: 'analysis_sample',
        detector: 'autocorrelation',
        frequency: freq,
        sampleTimeMs: elapsed,
        timelinePoints: timeline.length,
      });
    });

    const audioAnalysisSub = studioAddAudioAnalysisListener?.((event: StudioAudioAnalysisEvent) => {
      if (!this.nativeStreaming || startedAt == null) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= durationMs) return;

      const eventSegmentMs = Math.max(1, Number(event.segmentDurationMs ?? comparisonSegmentMs));
      const points = readStudioDataPoints(event);
      points.forEach((point, index) => {
        const frequency = readStudioPitchHz(point);
        if (frequency == null || frequency < 50 || frequency > 1200) return;

        const fallbackTimeMs = elapsed + (index * eventSegmentMs);
        const rawPointTime = typeof point.startTime === 'number'
          ? point.startTime
          : undefined;
        const pointTimeMs = normalizeStudioTimeMs(rawPointTime, fallbackTimeMs);

        studioPitchRealtimeTimeline.push({ timeMs: pointTimeMs, frequency });
        this.emitDebug({
          phase: 'analysis_sample',
          detector: 'studio_pitch',
          frequency,
          sampleTimeMs: pointTimeMs,
          timelinePoints: studioPitchRealtimeTimeline.length,
          message: 'studio_pitch_realtime',
        });
      });
    });

    try {
      // Start recording — no onAudioStream callback in options.
      // Data arrives via the EventEmitter listeners set up above.
      startRecordingResult = await studioStartRecording!({
        sampleRate: 44100,
        encoding: 'pcm_16bit',
        channels: 1,
        // ~2028 samples per callback at 44100 Hz — good window size for autoCorrelate
        interval: 46,
        // Request real-time pitch analysis from the native module.
        // intervalAnalysis matches interval so pitch data is emitted alongside PCM chunks.
        intervalAnalysis: 46,
        enableProcessing: true,
        features: { pitch: true },
        output: {
          primary: {
            enabled: true,
            format: 'wav',
          },
        },
      });
    
      startedAt = Date.now();
      this.emitDebug({ phase: 'recording', isRecording: true, message: 'recording_started' });
    } catch (error) {
      console.error('[pitch:start] error recording audio', error)
      this.nativeStreaming = false;
      audioDataSub?.remove();
      audioAnalysisSub?.remove();
      this.emitDebug({
        phase: 'error',
        detector: 'studio_pitch',
        message: error instanceof Error && error.message
          ? `studio_pitch_start_failed:${error.message}`
          : 'studio_pitch_start_failed',
      });
      throw error;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs);
    });

    this.nativeStreaming = false;
    audioDataSub?.remove();
    audioAnalysisSub?.remove();

    this.emitDebug({
      phase: 'recording',
      detector: 'studio_pitch',
      message: studioAddAudioAnalysisListener
        ? `studio_pitch_realtime_samples:${studioPitchRealtimeTimeline.length}`
        : 'studio_pitch_listener_unavailable',
    });

    let stopRecordingResult: StudioRecordingResult | null = null;
    try {
      stopRecordingResult = await studioStopRecording();
    } catch {}

    const recording: StudioRecordingResult | null = stopRecordingResult
      ? {
        ...stopRecordingResult,
        fileUri: stopRecordingResult.fileUri ?? startRecordingResult?.fileUri,
      }
      : (startRecordingResult?.fileUri ? { fileUri: startRecordingResult.fileUri } : null);

    this.emitDebug({
      phase: 'recorded',
      detector: 'studio_pitch',
      uri: recording?.fileUri ?? null,
      durationMillis: recording?.durationMs,
      message: recording?.fileUri
        ? `studio_pitch_recorded_file:${recording.fileUri}`
        : 'studio_pitch_recorded_file_missing',
    });

    // If real-time pitch collection worked, use it directly.
    // Otherwise fall back to post-recording extractAudioAnalysis on the saved WAV file.
    let studioPitchTimeline = studioPitchRealtimeTimeline;
    if (studioPitchTimeline.length === 0) {
      studioPitchTimeline = await this.extractStudioPitchTimeline(recording, comparisonSegmentMs);
      studioPitchTimeline.forEach((point, index) => {
        this.emitDebug({
          phase: 'analysis_sample',
          detector: 'studio_pitch',
          frequency: point.frequency,
          sampleTimeMs: point.timeMs,
          timelinePoints: index + 1,
        });
      });
    }

    this.emitDebug({
      phase: 'analysis_complete',
      timelinePoints: timeline.length,
      message: timeline.length > 0 || studioPitchTimeline.length > 0
        ? 'analysis_finished'
        : 'analysis_finished_without_pitch',
    });

    return { timeline, studioPitchTimeline };
  }

  private async extractStudioPitchTimeline(
    recording: StudioRecordingResult | null,
    segmentDurationMs: number,
  ): Promise<PitchTimelinePoint[]> {
    if (!recording?.fileUri) {
      this.emitDebug({
        phase: 'error',
        detector: 'studio_pitch',
        message: 'studio_pitch_analysis_missing_file_uri',
      });
      return [];
    }

    if (!studioExtractAudioAnalysis) {
      this.emitDebug({
        phase: 'error',
        detector: 'studio_pitch',
        message: 'studio_pitch_analysis_function_unavailable',
      });
      return [];
    }

    try {
      this.emitDebug({
        phase: 'analyzing',
        detector: 'studio_pitch',
        uri: recording.fileUri,
        durationMillis: recording.durationMs,
        message: 'studio_pitch_analysis_started',
      });

      // Give the native file writer a moment to fully flush before analysis.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 120);
      });

      const analysis = await studioExtractAudioAnalysis({
        fileUri: recording.fileUri,
        segmentDurationMs: Math.max(40, Math.round(segmentDurationMs)),
        features: { pitch: true },
      });

      const resolvedSegmentMs = Math.max(1, Number(analysis.segmentDurationMs ?? segmentDurationMs));
      const points = readStudioDataPoints(analysis)
        .map((point, index) => {
          const frequency = readStudioPitchHz(point);
          if (frequency == null || frequency < 50 || frequency > 1200) return null;

          const fallbackTimeMs = index * resolvedSegmentMs;
          const pointTime = typeof point.startTime === 'number'
            ? normalizeStudioTimeMs(point.startTime, fallbackTimeMs)
            : typeof point.endTime === 'number'
              ? Math.max(0, normalizeStudioTimeMs(point.endTime, fallbackTimeMs + resolvedSegmentMs) - resolvedSegmentMs)
              : fallbackTimeMs;

          return {
            timeMs: pointTime,
            frequency,
          };
        })
        .filter((point): point is PitchTimelinePoint => Boolean(point));

      this.emitDebug({
        phase: 'analyzing',
        detector: 'studio_pitch',
        timelinePoints: points.length,
        uri: recording.fileUri,
        durationMillis: recording.durationMs,
        message: points.length > 0
          ? 'studio_pitch_analysis_finished'
          : 'studio_pitch_analysis_finished_without_pitch',
      });

      return points;
    } catch (error) {
      console.error('[pitch:analyze] studio_pitch_analysis_failed', error);
      this.emitDebug({
        phase: 'error',
        detector: 'studio_pitch',
        uri: recording.fileUri,
        durationMillis: recording.durationMs,
        message: error instanceof Error && error.message
          ? `studio_pitch_analysis_failed:${error.message}`
          : 'studio_pitch_analysis_failed',
      });
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Web path (AnalyserNode — unchanged)
  // ---------------------------------------------------------------------------

  private async capturePitchSampleWeb(durationMs: number): Promise<{ detectedFrequency: number; detectedMidi: number; noteName: string | null } | null> {
    this.emitDebug({ phase: 'request_permission', message: 'checking_permissions' });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.emitDebug({ phase: 'request_permission', message: 'permission_granted' });

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.7;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    const frequencies: number[] = [];
    const pollMs = 60;
    const startedAt = Date.now();

    this.emitDebug({ phase: 'recording', isRecording: true, message: 'recording_started' });

    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= durationMs) {
          resolve();
          return;
        }

        analyser.getFloatTimeDomainData(buffer);
        const freq = autoCorrelate(buffer, audioCtx.sampleRate);
        if (Number.isFinite(freq) && freq >= 60 && freq <= 1200) {
          frequencies.push(freq);
          this.emitDebug({ phase: 'analysis_sample', frequency: freq, sampleTimeMs: elapsed, timelinePoints: frequencies.length });
        }

        setTimeout(tick, pollMs);
      };
      setTimeout(tick, pollMs);
    });

    for (const track of stream.getTracks()) {
      track.stop();
    }
    await audioCtx.close();

    this.emitDebug({ phase: 'analysis_complete', timelinePoints: frequencies.length, message: frequencies.length > 0 ? 'analysis_finished' : 'analysis_finished_without_pitch' });

    if (frequencies.length === 0) return null;

    const detectedFrequency = median(frequencies);
    const detectedMidi = noteFromPitch(detectedFrequency);
    const noteName = midiToScientific(detectedMidi);

    return { detectedFrequency, detectedMidi, noteName };
  }

  private async capturePitchContourWeb(durationMs: number, segmentMs: number): Promise<{
    detectedMidis: number[];
    detectedFrequencies: number[];
    segmentDurationMs?: number;
    detectedMidisBySegment?: Array<number | null>;
    detectedFrequenciesBySegment?: Array<number | null>;
    experimentalDetectedMidis?: number[];
    experimentalDetectedFrequencies?: number[];
    experimentalDetectedMidisBySegment?: Array<number | null>;
    experimentalDetectedFrequenciesBySegment?: Array<number | null>;
  } | null> {
    this.emitDebug({ phase: 'request_permission', message: 'checking_permissions' });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.emitDebug({ phase: 'request_permission', message: 'permission_granted' });

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.7;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    const timeline: PitchTimelinePoint[] = [];
    const pollMs = 60;
    const startedAt = Date.now();

    this.emitDebug({ phase: 'recording', isRecording: true, message: 'recording_started' });

    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= durationMs) {
          resolve();
          return;
        }

        analyser.getFloatTimeDomainData(buffer);
        const freq = autoCorrelate(buffer, audioCtx.sampleRate);
        if (Number.isFinite(freq) && freq >= 60 && freq <= 1200) {
          timeline.push({ timeMs: elapsed, frequency: freq });
          this.emitDebug({ phase: 'analysis_sample', frequency: freq, sampleTimeMs: elapsed, timelinePoints: timeline.length });
        }

        setTimeout(tick, pollMs);
      };
      setTimeout(tick, pollMs);
    });

    for (const track of stream.getTracks()) {
      track.stop();
    }
    await audioCtx.close();

    this.emitDebug({ phase: 'analysis_complete', timelinePoints: timeline.length, message: timeline.length > 0 ? 'analysis_finished' : 'analysis_finished_without_pitch' });

    if (timeline.length === 0) return null;

    const safeSegmentMs = Math.max(250, segmentMs);
    const totalDurationMs = Math.max(safeSegmentMs, durationMs);
    const segmentCount = Math.max(1, Math.round(totalDurationMs / safeSegmentMs));
    const detectedFrequencies: number[] = [];
    const detectedFrequenciesBySegment: Array<number | null> = [];

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const start = segment * safeSegmentMs;
      const end = start + safeSegmentMs;
      const inWindow = timeline.filter((p) => p.timeMs >= start && p.timeMs < end).map((p) => p.frequency);
      if (inWindow.length === 0) {
        detectedFrequenciesBySegment.push(null);
        continue;
      }
      const bucket = median(inWindow);
      detectedFrequencies.push(bucket);
      detectedFrequenciesBySegment.push(bucket);
    }

    if (detectedFrequencies.length === 0) return null;

    const detectedMidisBySegment = detectedFrequenciesBySegment.map((frequency) => (
      frequency == null ? null : noteFromPitch(frequency)
    ));

    return {
      detectedFrequencies,
      detectedMidis: detectedFrequencies.map((f) => noteFromPitch(f)),
      segmentDurationMs: safeSegmentMs,
      detectedFrequenciesBySegment,
      detectedMidisBySegment,
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async capturePitchSample(durationMs: number): Promise<{
    detectedFrequency: number;
    detectedMidi: number;
    noteName: string | null;
    experimentalDetectedFrequency?: number | null;
    experimentalDetectedMidi?: number | null;
    experimentalNoteName?: string | null;
  } | null> {
    if (Platform.OS === 'web' ) {
      return this.capturePitchSampleWeb(Math.max(500, durationMs));
    }

    const captureMs = Math.max(500, durationMs);
    const { timeline, studioPitchTimeline } = await this.streamPitchNative(captureMs, 100);
    const frequencies = timeline.map((point) => point.frequency);
    const studioFrequencies = studioPitchTimeline.map((point) => point.frequency);

    if (frequencies.length === 0) return null;

    const detectedFrequency = median(frequencies);
    const detectedMidi = noteFromPitch(detectedFrequency);
    const noteName = midiToScientific(detectedMidi);

    const experimentalDetectedFrequency = studioFrequencies.length > 0 ? median(studioFrequencies) : null;
    const experimentalDetectedMidi = experimentalDetectedFrequency != null ? noteFromPitch(experimentalDetectedFrequency) : null;
    const experimentalNoteName = experimentalDetectedMidi != null ? midiToScientific(experimentalDetectedMidi) : null;

    return {
      detectedFrequency,
      detectedMidi,
      noteName,
      experimentalDetectedFrequency,
      experimentalDetectedMidi,
      experimentalNoteName,
    };
  }

  async capturePitchContour(durationMs: number, segmentMs: number): Promise<{
    detectedMidis: number[];
    detectedFrequencies: number[];
    segmentDurationMs?: number;
    detectedMidisBySegment?: Array<number | null>;
    detectedFrequenciesBySegment?: Array<number | null>;
    experimentalDetectedMidis?: number[];
    experimentalDetectedFrequencies?: number[];
    experimentalDetectedMidisBySegment?: Array<number | null>;
    experimentalDetectedFrequenciesBySegment?: Array<number | null>;
  } | null> {
    if (Platform.OS === 'web') {
      return this.capturePitchContourWeb(Math.max(1000, durationMs), segmentMs);
    }

    const captureMs = Math.max(1000, durationMs);
    const { timeline, studioPitchTimeline } = await this.streamPitchNative(captureMs, segmentMs);

    if (timeline.length === 0) return null;

    const safeSegmentMs = Math.max(250, segmentMs);
    const totalDurationMs = Math.max(safeSegmentMs, captureMs);
    const segmentCount = Math.max(1, Math.round(totalDurationMs / safeSegmentMs));
    const detectedFrequencies: number[] = [];
    const detectedFrequenciesBySegment: Array<number | null> = [];

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const start = segment * safeSegmentMs;
      const end = start + safeSegmentMs;
      const inWindow = timeline
        .filter((point) => point.timeMs >= start && point.timeMs < end)
        .map((point) => point.frequency);

      if (inWindow.length === 0) {
        detectedFrequenciesBySegment.push(null);
        continue;
      }

      const bucket = median(inWindow);
      detectedFrequencies.push(bucket);
      detectedFrequenciesBySegment.push(bucket);
    }

    if (detectedFrequencies.length === 0) return null;

    const experimentalDetectedFrequencies: number[] = [];
    const experimentalDetectedFrequenciesBySegment: Array<number | null> = [];
    if (studioPitchTimeline.length > 0) {
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const start = segment * safeSegmentMs;
        const end = start + safeSegmentMs;
        const inWindow = studioPitchTimeline
          .filter((point) => point.timeMs >= start && point.timeMs < end)
          .map((point) => point.frequency);

        if (inWindow.length === 0) {
          experimentalDetectedFrequenciesBySegment.push(null);
          continue;
        }

        const bucket = median(inWindow);
        experimentalDetectedFrequencies.push(bucket);
        experimentalDetectedFrequenciesBySegment.push(bucket);
      }
    }

    const detectedMidisBySegment = detectedFrequenciesBySegment.map((frequency) => (
      frequency == null ? null : noteFromPitch(frequency)
    ));
    const experimentalDetectedMidisBySegment = experimentalDetectedFrequenciesBySegment.map((frequency) => (
      frequency == null ? null : noteFromPitch(frequency)
    ));

    return {
      detectedFrequencies,
      detectedMidis: detectedFrequencies.map((frequency) => noteFromPitch(frequency)),
      segmentDurationMs: safeSegmentMs,
      detectedFrequenciesBySegment,
      detectedMidisBySegment,
      experimentalDetectedFrequencies,
      experimentalDetectedMidis: experimentalDetectedFrequencies.map((frequency) => noteFromPitch(frequency)),
      experimentalDetectedFrequenciesBySegment,
      experimentalDetectedMidisBySegment,
    };
  }

  async stop(): Promise<void> {
    if (this.nativeStreaming) {
      this.nativeStreaming = false;
      if (studioStopRecording) {
        try {
          await studioStopRecording();
        } catch {}
      }
    }

    this.emitDebug({
      phase: 'idle',
      message: 'stopped',
    });
  }
}
