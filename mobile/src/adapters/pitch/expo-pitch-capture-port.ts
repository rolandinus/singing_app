import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';
import { midiToScientific } from '../../core/utils/note-helpers';
import { autoCorrelateWithDiagnostics, noteFromPitch, type AutoCorrelatePeak } from '../../core/utils/pitch';

// @siteed/expo-audio-studio is used for real-time PCM streaming on native (iOS/Android).
// It is not imported on web — the AnalyserNode path is used there instead.
//
// IMPORTANT: The native ExpoAudioStream module delivers audio data via EventEmitter
// ('AudioData' and 'AudioAnalysis' events), NOT via callbacks in startRecording options.
// The useAudioRecorder hook strips onAudioStream/onAudioAnalysis before calling native
// startRecording and sets up event listeners separately. We replicate that pattern here.
let studioStartRecording: ((options: StudioRecordingOptions) => Promise<StudioStartRecordingResult>) | null = null;
let studioStopRecording: (() => Promise<StudioRecordingResult | null>) | null = null;
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
    } catch (error) {
      console.log('[pitch:init] expo-modules-core LegacyEventEmitter unavailable', error);
      // expo-modules-core not available — fallback listeners stay null
    }
  }
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
  position?: number;
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
  durationMs?: number;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
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
  if (timeValue! <= 0) return 0;
  // expo-audio-studio emits DataPoint.startTime/endTime in seconds (native + web).
  // Convert to ms for the rest of the singing pipeline.
  return timeValue! < 30 ? timeValue! * 1000 : timeValue!;
}

type PitchTimelinePoint = { timeMs: number; frequency: number };
type DetectorSource = 'studio_pitch';

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

function summarizeTopPeaks(peaks: AutoCorrelatePeak[]): Array<{ hz: number; lag: number; corr: number }> {
  return peaks.slice(0, 4).map((peak) => ({
    hz: Math.round(peak.frequency * 10) / 10,
    lag: peak.lag,
    corr: Math.round(peak.correlation * 1000) / 1000,
  }));
}

function shouldLogAutoCorrelationDiagnostic(sampleNr: number, frequency: number, subharmonicRatio: number | null): boolean {
  if (sampleNr <= 3) return true;
  if (sampleNr % 12 === 0) return true;
  if (Number.isFinite(frequency) && frequency >= 450 && frequency <= 580) return true;
  if (subharmonicRatio != null && subharmonicRatio >= 0.82) return true;
  return false;
}

function buildPitchContourResult(
  timeline: PitchTimelinePoint[],
  totalDurationMs: number,
  segmentMs: number,
): {
  detectedMidis: number[];
  detectedFrequencies: number[];
  segmentDurationMs: number;
  detectedMidisBySegment: Array<number | null>;
  detectedFrequenciesBySegment: Array<number | null>;
} | null {
  const safeSegmentMs = Math.max(250, segmentMs);
  const segmentCount = Math.max(1, Math.round(Math.max(safeSegmentMs, totalDurationMs) / safeSegmentMs));
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

  const detectedMidisBySegment = detectedFrequenciesBySegment.map((f) => (f == null ? null : noteFromPitch(f)));

  return {
    detectedFrequencies,
    detectedMidis: detectedFrequencies.map((f) => noteFromPitch(f)),
    segmentDurationMs: safeSegmentMs,
    detectedFrequenciesBySegment,
    detectedMidisBySegment,
  };
}

type EarlyCaptureState = {
  startedAt: number;
  timeline: PitchTimelinePoint[];
  startRecordingResult: StudioStartRecordingResult;
  audioDataSub: { remove: () => void } | null;
  audioAnalysisSub: { remove: () => void } | null;
};

export class ExpoPitchCapturePort {
  /** True while a native streaming session is active. */
  private nativeStreaming = false;
  private debugListener: PitchCaptureDebugListener = null;
  private autoCorrelationSampleCounter = 0;
  private studioPitchSampleCounter = 0;
  private earlyCapture: EarlyCaptureState | null = null;

  setDebugListener(listener: PitchCaptureDebugListener): void {
    this.debugListener = listener;
    if (listener) {
      this.emitDebug({ phase: 'idle', message: 'listener_attached' });
    }
  }

  private emitDebug(snapshot: Omit<PitchCaptureDebugSnapshot, 'timestampMs'>): void {
    if (!this.debugListener) return;
    const full = { ...snapshot, timestampMs: Date.now() };
    console.log(full);
    try {
      this.debugListener(full);
    } catch (error) {
      console.log('[pitch:debug] emitDebug listener failed', error);
    }
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
   * Pre-warm the native audio session: check permissions and configure audio mode.
   * Call this before the count-in so the setup latency is paid before recording starts.
   * No-op on web.
   */
  async prepareForRecording(): Promise<void> {
    if (Platform.OS === 'web') return;
    await this.ensurePermissions();
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });
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
      } catch (error) {
        console.log('[pitch:permission] getUserMedia failed', error);
        this.emitDebug({ phase: 'error', message: 'microphone_permission_denied' });
        throw new Error('Mikrofonberechtigung wurde nicht erteilt.');
      }
      this.emitDebug({ phase: 'request_permission', message: 'permission_granted' });
      return;
    }

    await this.ensurePermissions();
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
    studioPitchTimeline: PitchTimelinePoint[];
  }> {
    if (!studioStartRecording || !studioStopRecording) {
      throw new Error('Native audio studio module is not available.');
    }

    await this.stop();
    // permissions and audio mode are pre-called via prepareForRecording() before count-in

    const studioPitchRealtimeTimeline: PitchTimelinePoint[] = [];
    let startedAt: number | null = null;
    let startRecordingResult: StudioStartRecordingResult | null = null;
    let lastNativeChunkStartMs: number | null = null;
    let lastNativeChunkDurationMs: number | null = null;
    this.studioPitchSampleCounter = 0;

    this.nativeStreaming = true;

    // Set up event listeners BEFORE starting recording so no events are missed.
    const audioDataSub = studioAddAudioDataListener?.((event: StudioAudioDataEvent) => {
      if (!this.nativeStreaming || startedAt == null) return;
      const callbackElapsed = Date.now() - startedAt;

      const nativeChunkStartMs = Number.isFinite(event.position)
        ? Math.max(0, Number(event.position))
        : callbackElapsed;

      const deltaBytes = Number.isFinite(event.deltaSize) ? Math.max(0, Number(event.deltaSize)) : 0;
      const chunkDurationMs = deltaBytes > 0
        ? (deltaBytes / (44100 * 2)) * 1000
        : 0;
      const sampleTimeMs = Math.round(nativeChunkStartMs + (chunkDurationMs / 2));
      lastNativeChunkStartMs = nativeChunkStartMs;
      lastNativeChunkDurationMs = chunkDurationMs;

      if (sampleTimeMs >= durationMs) {
        console.log('[pitch:auto:timing] dropping_late_chunk', {
          callbackElapsedMs: callbackElapsed,
          nativeChunkStartMs,
          chunkDurationMs: Math.round(chunkDurationMs),
          sampleTimeMs,
          captureDurationMs: durationMs,
        });
      }
    });

    const audioAnalysisSub = studioAddAudioAnalysisListener?.((event: StudioAudioAnalysisEvent) => {
      if (!this.nativeStreaming || startedAt == null) return;
      const callbackElapsed = Date.now() - startedAt;

      const eventSegmentMs = Math.max(1, Number(event.segmentDurationMs ?? comparisonSegmentMs));
      const analysisDurationMs = Math.max(
        eventSegmentMs,
        Number.isFinite(event.durationMs)
          ? Number(event.durationMs)
          : eventSegmentMs * Math.max(1, readStudioDataPoints(event).length),
      );
      const latestChunkEndMs = lastNativeChunkStartMs != null
        ? lastNativeChunkStartMs + (lastNativeChunkDurationMs ?? 0)
        : callbackElapsed;
      const analysisChunkStartMs = Math.max(0, latestChunkEndMs - analysisDurationMs);
      const points = readStudioDataPoints(event);
      points.forEach((point, index) => {
        const frequency = readStudioPitchHz(point);
        if (frequency == null || frequency < 50 || frequency > 1200) return;
        this.studioPitchSampleCounter += 1;

        const fallbackRelativeMs = index * eventSegmentMs;
        const relativeStartMs = typeof point.startTime === 'number'
          ? normalizeStudioTimeMs(point.startTime, fallbackRelativeMs)
          : typeof point.endTime === 'number'
            ? Math.max(0, normalizeStudioTimeMs(point.endTime, fallbackRelativeMs + eventSegmentMs) - eventSegmentMs)
            : fallbackRelativeMs;
        const pointTimeMs = Math.round(analysisChunkStartMs + relativeStartMs);
        if (pointTimeMs >= durationMs) {
          console.log('[pitch:studio:timing] dropping_late_analysis_point', {
            callbackElapsedMs: callbackElapsed,
            analysisChunkStartMs: Math.round(analysisChunkStartMs),
            analysisDurationMs: Math.round(analysisDurationMs),
            relativeStartMs: Math.round(relativeStartMs),
            pointTimeMs,
            captureDurationMs: durationMs,
          });
          return;
        }

        if (
          this.studioPitchSampleCounter <= 3
          || this.studioPitchSampleCounter % 12 === 0
          || (frequency >= 450 && frequency <= 580)
        ) {
          console.log('[pitch:studio:diag]', {
            source: 'native_realtime',
            sampleNr: this.studioPitchSampleCounter,
            callbackElapsedMs: Math.round(callbackElapsed),
            analysisChunkStartMs: Math.round(analysisChunkStartMs),
            analysisDurationMs: Math.round(analysisDurationMs),
            elapsedMs: Math.round(pointTimeMs),
            frequency: Math.round(frequency * 10) / 10,
            startTime: point.startTime ?? null,
            endTime: point.endTime ?? null,
            segmentDurationMs: eventSegmentMs,
          });
        }

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

    let stopRecordingResult: StudioRecordingResult | null = null;
    try {
      // Start recording — no onAudioStream callback in options.
      // Data arrives via the EventEmitter listeners set up above.
      startRecordingResult = await studioStartRecording({
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

      await sleep(durationMs);
    } catch (error) {
      if (startRecordingResult === null) {
        // start itself failed — nothing to stop
        console.error('[pitch:start] error recording audio', error);
        this.emitDebug({
          phase: 'error',
          detector: 'studio_pitch',
          message: error instanceof Error && error.message
            ? `studio_pitch_start_failed:${error.message}`
            : 'studio_pitch_start_failed',
        });
      }
      throw error;
    } finally {
      this.nativeStreaming = false;
      audioDataSub?.remove();
      audioAnalysisSub?.remove();
      if (startRecordingResult !== null) {
        try {
          stopRecordingResult = await studioStopRecording();
        } catch (stopError) {
          console.log('[pitch:stop] failed to stop recording cleanly', stopError);
        }
      }
    }

    this.emitDebug({
      phase: 'recording',
      detector: 'studio_pitch',
      message: studioAddAudioAnalysisListener
        ? `studio_pitch_realtime_samples:${studioPitchRealtimeTimeline.length}`
        : 'studio_pitch_listener_unavailable',
    });

    const recording: StudioRecordingResult | null = stopRecordingResult
      ? { ...stopRecordingResult, fileUri: stopRecordingResult.fileUri ?? startRecordingResult?.fileUri }
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
      timelinePoints: studioPitchTimeline.length,
      message: studioPitchTimeline.length > 0
        ? 'analysis_finished'
        : 'analysis_finished_without_pitch',
    });

    return { studioPitchTimeline };
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
      await sleep(120);

      const analysis = await studioExtractAudioAnalysis({
        fileUri: recording.fileUri,
        segmentDurationMs: Math.max(40, Math.round(segmentDurationMs)),
        features: { pitch: true },
      });

      const resolvedSegmentMs = Math.max(1, Number(analysis.segmentDurationMs ?? segmentDurationMs));
      const rawPoints = readStudioDataPoints(analysis);
      console.log('[studio_pitch:diag] dataPoints count:', rawPoints.length, 'segmentDurationMs:', analysis.segmentDurationMs);
      if (rawPoints.length > 0) {
        const sample = rawPoints.slice(0, 5);
        console.log('[studio_pitch:diag] first points (features.pitch):', sample.map((p) => p.features?.pitch ?? '(no features.pitch)'));
        console.log('[studio_pitch:diag] first point keys:', Object.keys(sample[0] ?? {}));
      }
      const points = rawPoints
        .map((point, index) => {
          const frequency = readStudioPitchHz(point);
          if (frequency == null || frequency < 50 || frequency > 1200) return null;

          const fallbackTimeMs = index * resolvedSegmentMs;
          const pointTime = typeof point.startTime === 'number'
            ? normalizeStudioTimeMs(point.startTime, fallbackTimeMs)
            : typeof point.endTime === 'number'
              ? Math.max(0, normalizeStudioTimeMs(point.endTime, fallbackTimeMs + resolvedSegmentMs) - resolvedSegmentMs)
              : fallbackTimeMs;

          return { timeMs: pointTime, frequency };
        })
        .filter((point): point is PitchTimelinePoint => Boolean(point));

      const around500Count = points.filter((point) => point.frequency >= 450 && point.frequency <= 580).length;
      const bucketCounts = new Map<number, number>();
      points.forEach((point) => {
        const bucket = Math.round(point.frequency / 25) * 25;
        bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
      });
      const topBuckets = Array.from(bucketCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hz, count]) => ({ hz, count }));
      console.log('[studio_pitch:diag] summary', {
        points: points.length,
        around500Count,
        around500Ratio: points.length > 0 ? Math.round((around500Count / points.length) * 1000) / 1000 : 0,
        topBuckets,
      });

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

  private async openWebAnalyser(): Promise<{ audioCtx: AudioContext; analyser: AnalyserNode; stream: MediaStream }> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.7;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    return { audioCtx, analyser, stream };
  }

  private runWebAutoCorrelateLoop(
    analyser: AnalyserNode,
    audioCtx: AudioContext,
    durationMs: number,
    onSample: (freq: number, elapsed: number) => void,
  ): Promise<void> {
    const buffer = new Float32Array(analyser.fftSize);
    const pollMs = 60;
    const startedAt = Date.now();
    this.autoCorrelationSampleCounter = 0;

    return new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= durationMs) { resolve(); return; }

        analyser.getFloatTimeDomainData(buffer);
        this.autoCorrelationSampleCounter += 1;
        const auto = autoCorrelateWithDiagnostics(buffer, audioCtx.sampleRate);
        const freq = auto.frequency;
        if (shouldLogAutoCorrelationDiagnostic(this.autoCorrelationSampleCounter, freq, auto.diagnostics.subharmonicRatio)) {
          console.log('[pitch:auto:diag]', {
            sampleNr: this.autoCorrelationSampleCounter,
            elapsedMs: elapsed,
            frequency: Number.isFinite(freq) ? Math.round(freq * 10) / 10 : null,
            rms: Math.round(auto.diagnostics.rms * 10000) / 10000,
            reason: auto.diagnostics.reason,
            selectedLag: auto.diagnostics.selectedLag,
            bestLag: auto.diagnostics.bestLag,
            subharmonicHz: auto.diagnostics.subharmonicFrequency == null
              ? null
              : Math.round(auto.diagnostics.subharmonicFrequency * 10) / 10,
            subharmonicRatio: auto.diagnostics.subharmonicRatio == null
              ? null
              : Math.round(auto.diagnostics.subharmonicRatio * 1000) / 1000,
            peaks: summarizeTopPeaks(auto.diagnostics.topPeaks),
          });
        }
        if (Number.isFinite(freq) && freq >= 60 && freq <= 1200) {
          onSample(freq, elapsed);
        }

        setTimeout(tick, pollMs);
      };
      setTimeout(tick, pollMs);
    });
  }

  private async capturePitchSampleWeb(durationMs: number): Promise<{ detectedFrequency: number; detectedMidi: number; noteName: string | null } | null> {
    this.emitDebug({ phase: 'request_permission', message: 'checking_permissions' });
    const { audioCtx, analyser, stream } = await this.openWebAnalyser();
    this.emitDebug({ phase: 'request_permission', message: 'permission_granted' });
    this.emitDebug({ phase: 'recording', isRecording: true, message: 'recording_started' });

    const frequencies: number[] = [];
    await this.runWebAutoCorrelateLoop(analyser, audioCtx, durationMs, (freq, elapsed) => {
      frequencies.push(freq);
      this.emitDebug({ phase: 'analysis_sample', frequency: freq, sampleTimeMs: elapsed, timelinePoints: frequencies.length });
    });

    for (const track of stream.getTracks()) { track.stop(); }
    await audioCtx.close();

    this.emitDebug({ phase: 'analysis_complete', timelinePoints: frequencies.length, message: frequencies.length > 0 ? 'analysis_finished' : 'analysis_finished_without_pitch' });

    if (frequencies.length === 0) return null;

    const detectedFrequency = median(frequencies);
    const detectedMidi = noteFromPitch(detectedFrequency);
    return { detectedFrequency, detectedMidi, noteName: midiToScientific(detectedMidi) };
  }

  private async capturePitchContourWeb(durationMs: number, segmentMs: number): Promise<{
    detectedMidis: number[];
    detectedFrequencies: number[];
    segmentDurationMs?: number;
    detectedMidisBySegment?: Array<number | null>;
    detectedFrequenciesBySegment?: Array<number | null>;
  } | null> {
    this.emitDebug({ phase: 'request_permission', message: 'checking_permissions' });
    const { audioCtx, analyser, stream } = await this.openWebAnalyser();
    this.emitDebug({ phase: 'request_permission', message: 'permission_granted' });
    this.emitDebug({ phase: 'recording', isRecording: true, message: 'recording_started' });

    const timeline: PitchTimelinePoint[] = [];
    await this.runWebAutoCorrelateLoop(analyser, audioCtx, durationMs, (freq, elapsed) => {
      timeline.push({ timeMs: elapsed, frequency: freq });
      this.emitDebug({ phase: 'analysis_sample', frequency: freq, sampleTimeMs: elapsed, timelinePoints: timeline.length });
    });

    for (const track of stream.getTracks()) { track.stop(); }
    await audioCtx.close();

    this.emitDebug({ phase: 'analysis_complete', timelinePoints: timeline.length, message: timeline.length > 0 ? 'analysis_finished' : 'analysis_finished_without_pitch' });

    if (timeline.length === 0) return null;
    return buildPitchContourResult(timeline, durationMs, segmentMs);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async capturePitchSample(durationMs: number): Promise<{
    detectedFrequency: number;
    detectedMidi: number;
    noteName: string | null;
  } | null> {
    if (Platform.OS === 'web' ) {
      return this.capturePitchSampleWeb(Math.max(500, durationMs));
    }

    const captureMs = Math.max(500, durationMs);
    const { studioPitchTimeline } = await this.streamPitchNative(captureMs, 100);
    const frequencies = studioPitchTimeline.map((point) => point.frequency);

    if (frequencies.length === 0) return null;

    const detectedFrequency = median(frequencies);
    const detectedMidi = noteFromPitch(detectedFrequency);
    return { detectedFrequency, detectedMidi, noteName: midiToScientific(detectedMidi) };
  }

  async capturePitchContour(durationMs: number, segmentMs: number): Promise<{
    detectedMidis: number[];
    detectedFrequencies: number[];
    segmentDurationMs?: number;
    detectedMidisBySegment?: Array<number | null>;
    detectedFrequenciesBySegment?: Array<number | null>;
  } | null> {
    if (Platform.OS === 'web') {
      return this.capturePitchContourWeb(Math.max(1000, durationMs), segmentMs);
    }

    const captureMs = Math.max(1000, durationMs);
    const { studioPitchTimeline } = await this.streamPitchNative(captureMs, segmentMs);

    if (studioPitchTimeline.length === 0) return null;
    return buildPitchContourResult(studioPitchTimeline, captureMs, segmentMs);
  }

  /**
   * Post-process a recorded WAV file with the studio pitch detector.
   * Useful as a more reliable alternative to the real-time analysis path.
   */
  async analyzeWavPitch(
    uri: string,
    segmentMs = 80,
  ): Promise<Array<{ timeMs: number; frequency: number }>> {
    return this.extractStudioPitchTimeline({ fileUri: uri }, segmentMs);
  }

  /**
   * Start recording before the count-in so the native audio session is definitely
   * active when the cursor begins. Call this before scheduling the count-in, then
   * call finishCapture() after the count-in completes.
   *
   * Returns the wall-clock timestamp (ms) when recording actually started, which
   * the caller uses to compute preRollMs.
   *
   * No-op on web (returns 0).
   */
  async startCaptureEarly(): Promise<number> {
    if (Platform.OS === 'web' || !studioStartRecording || !studioStopRecording) return 0;

    await this.stop();

    const timeline: PitchTimelinePoint[] = [];
    let startedAt = 0;
    // These are captured by the closures below and mutated by audioDataSub.
    let lastNativeChunkStartMs: number | null = null;
    let lastNativeChunkDurationMs: number | null = null;
    this.studioPitchSampleCounter = 0;
    this.nativeStreaming = true;

    const audioDataSub = studioAddAudioDataListener?.((event: StudioAudioDataEvent) => {
      if (!this.nativeStreaming || startedAt === 0) return;
      const deltaBytes = Number.isFinite(event.deltaSize) ? Math.max(0, Number(event.deltaSize)) : 0;
      lastNativeChunkStartMs = Number.isFinite(event.position)
        ? Math.max(0, Number(event.position))
        : Date.now() - startedAt;
      lastNativeChunkDurationMs = deltaBytes > 0 ? (deltaBytes / (44100 * 2)) * 1000 : 0;
    }) ?? null;

    const audioAnalysisSub = studioAddAudioAnalysisListener?.((event: StudioAudioAnalysisEvent) => {
      if (!this.nativeStreaming || startedAt === 0) return;
      const callbackElapsed = Date.now() - startedAt;
      const eventSegmentMs = Math.max(1, Number(event.segmentDurationMs ?? 100));
      const analysisDurationMs = Math.max(
        eventSegmentMs,
        Number.isFinite(event.durationMs)
          ? Number(event.durationMs)
          : eventSegmentMs * Math.max(1, readStudioDataPoints(event).length),
      );
      const latestChunkEndMs = lastNativeChunkStartMs != null
        ? lastNativeChunkStartMs + (lastNativeChunkDurationMs ?? 0)
        : callbackElapsed;
      const analysisChunkStartMs = Math.max(0, latestChunkEndMs - analysisDurationMs);
      const points = readStudioDataPoints(event);
      points.forEach((point, index) => {
        const frequency = readStudioPitchHz(point);
        if (frequency == null || frequency < 50 || frequency > 1200) return;
        this.studioPitchSampleCounter += 1;
        const fallbackRelativeMs = index * eventSegmentMs;
        const relativeStartMs = typeof point.startTime === 'number'
          ? normalizeStudioTimeMs(point.startTime, fallbackRelativeMs)
          : typeof point.endTime === 'number'
            ? Math.max(0, normalizeStudioTimeMs(point.endTime, fallbackRelativeMs + eventSegmentMs) - eventSegmentMs)
            : fallbackRelativeMs;
        timeline.push({ timeMs: Math.round(analysisChunkStartMs + relativeStartMs), frequency });
      });
    }) ?? null;

    try {
      const startRecordingResult = await studioStartRecording({
        sampleRate: 44100,
        encoding: 'pcm_16bit',
        channels: 1,
        interval: 46,
        intervalAnalysis: 46,
        enableProcessing: true,
        features: { pitch: true },
        output: { primary: { enabled: true, format: 'wav' } },
      });
      startedAt = Date.now();
      this.earlyCapture = { startedAt, timeline, startRecordingResult, audioDataSub, audioAnalysisSub };
      this.emitDebug({ phase: 'recording', isRecording: true, message: 'early_capture_started' });
      return startedAt;
    } catch (error) {
      this.nativeStreaming = false;
      audioDataSub?.remove();
      audioAnalysisSub?.remove();
      console.error('[pitch:startCaptureEarly] studioStartRecording failed', error);
      throw error;
    }
  }

  /**
   * Complete a recording started with startCaptureEarly().
   *
   * Sleeps until the full capture window (preRollMs + captureDurationMs) has elapsed
   * since recording started, then stops and returns the pitch contour with timestamps
   * shifted so that t=0 corresponds to cursor start (not recording start).
   *
   * preRollMs = cursorStartsAt - recordingStartedAt
   */
  async finishCapture(
    captureDurationMs: number,
    segmentMs: number,
    preRollMs: number,
  ): Promise<{
    detectedMidis: number[];
    detectedFrequencies: number[];
    segmentDurationMs?: number;
    detectedMidisBySegment?: Array<number | null>;
    detectedFrequenciesBySegment?: Array<number | null>;
  } | null> {
    const capture = this.earlyCapture;
    if (!capture) return null;
    this.earlyCapture = null;

    // Sleep until the full recording window has elapsed.
    const recordEndAt = capture.startedAt + Math.max(0, preRollMs) + captureDurationMs;
    const remainingMs = recordEndAt - Date.now();
    if (remainingMs > 0) await sleep(remainingMs);

    // Stop recording.
    this.nativeStreaming = false;
    capture.audioDataSub?.remove();
    capture.audioAnalysisSub?.remove();
    let stopRecordingResult: StudioRecordingResult | null = null;
    if (studioStopRecording) {
      try {
        stopRecordingResult = await studioStopRecording();
      } catch (stopError) {
        console.log('[pitch:finishCapture] studioStopRecording failed', stopError);
      }
    }

    // Shift timeline so t=0 is cursor start, discard pre-roll and post-capture samples.
    const safePreRollMs = Math.max(0, preRollMs);
    let timeline = capture.timeline
      .map((p) => ({ timeMs: p.timeMs - safePreRollMs, frequency: p.frequency }))
      .filter((p) => p.timeMs >= 0 && p.timeMs < captureDurationMs);

    // Fallback: post-recording file analysis if real-time path collected nothing.
    if (timeline.length === 0) {
      const fileUri = stopRecordingResult?.fileUri ?? capture.startRecordingResult.fileUri;
      if (fileUri) {
        const rawTimeline = await this.extractStudioPitchTimeline({ fileUri }, segmentMs);
        timeline = rawTimeline
          .map((p) => ({ timeMs: p.timeMs - safePreRollMs, frequency: p.frequency }))
          .filter((p) => p.timeMs >= 0 && p.timeMs < captureDurationMs);
      }
    }

    this.emitDebug({
      phase: 'analysis_complete',
      timelinePoints: timeline.length,
      message: timeline.length > 0 ? 'early_capture_finished' : 'early_capture_finished_without_pitch',
    });

    if (timeline.length === 0) return null;
    return buildPitchContourResult(timeline, captureDurationMs, segmentMs);
  }

  async stop(): Promise<void> {
    if (this.earlyCapture) {
      this.earlyCapture.audioDataSub?.remove();
      this.earlyCapture.audioAnalysisSub?.remove();
      this.earlyCapture = null;
    }
    if (this.nativeStreaming) {
      this.nativeStreaming = false;
      if (studioStopRecording) {
        try {
          await studioStopRecording();
        } catch (error) {
          console.log('[pitch:stop] failed to stop active stream', error);
        }
      }
    }

    this.emitDebug({ phase: 'idle', message: 'stopped' });
  }
}
