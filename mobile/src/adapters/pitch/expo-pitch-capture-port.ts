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
let studioStartRecording: ((options: StudioRecordingOptions) => Promise<void>) | null = null;
let studioStopRecording: (() => Promise<void>) | null = null;
let studioConvertPCMToFloat32: ((data: string, bitDepth: number) => Float32Array) | null = null;

if (Platform.OS !== 'web') {
  // Dynamic require to avoid bundling on web where the native module is unavailable.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const studio = require('@siteed/expo-audio-studio') as {
    startRecording: (options: StudioRecordingOptions) => Promise<void>;
    stopRecording: () => Promise<void>;
    convertPCMToFloat32: (data: string, bitDepth: number) => Float32Array;
  };
  studioStartRecording = studio.startRecording;
  studioStopRecording = studio.stopRecording;
  studioConvertPCMToFloat32 = studio.convertPCMToFloat32;
}

interface StudioAudioStreamEvent {
  data: string | Float32Array;
}

interface StudioRecordingOptions {
  sampleRate: number;
  encoding: 'pcm_16bit' | 'pcm_32bit';
  channels: number;
  interval: number;
  onAudioStream: (event: StudioAudioStreamEvent) => Promise<void> | void;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

type PitchTimelinePoint = { timeMs: number; frequency: number };

export type PitchCaptureDebugSnapshot = {
  phase: 'idle' | 'request_permission' | 'recording' | 'recorded' | 'analyzing' | 'analysis_sample' | 'analysis_complete' | 'error';
  timestampMs: number;
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
   * Returns the accumulated pitch timeline.
   */
  private async streamPitchNative(durationMs: number): Promise<{ timeline: PitchTimelinePoint[] }> {
    if (!studioStartRecording || !studioStopRecording || !studioConvertPCMToFloat32) {
      throw new Error('Native audio studio module is not available.');
    }

    await this.stop();
    await this.ensurePermissions();
    await this.configureAudioModeForRecording();

    const timeline: PitchTimelinePoint[] = [];
    const startedAt = Date.now();
    const convertPCM = studioConvertPCMToFloat32;

    this.emitDebug({ phase: 'recording', isRecording: true, message: 'recording_started' });
    this.nativeStreaming = true;

    await new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        resolve();
      }, durationMs);

      studioStartRecording!({
        sampleRate: 44100,
        encoding: 'pcm_16bit',
        channels: 1,
        // ~2028 samples per callback at 44100 Hz — good window size for autoCorrelate
        interval: 46,
        onAudioStream: ({ data }) => {
          if (!this.nativeStreaming) return;

          const elapsed = Date.now() - startedAt;
          if (elapsed >= durationMs) {
            clearTimeout(timeoutHandle);
            resolve();
            return;
          }

          let pcm: Float32Array;
          if (typeof data === 'string') {
            try {
              pcm = convertPCM(data, 16);
            } catch {
              return;
            }
          } else {
            pcm = data;
          }

          if (pcm.length < 256) return;

          const freq = autoCorrelate(pcm, 44100);
          if (!Number.isFinite(freq) || freq < 60 || freq > 1200) return;

          timeline.push({ timeMs: elapsed, frequency: freq });

          this.emitDebug({
            phase: 'analysis_sample',
            frequency: freq,
            sampleTimeMs: elapsed,
            timelinePoints: timeline.length,
          });
        },
      }).catch((err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });
    });

    this.nativeStreaming = false;
    try {
      await studioStopRecording();
    } catch {}

    this.emitDebug({
      phase: 'analysis_complete',
      timelinePoints: timeline.length,
      message: timeline.length > 0 ? 'analysis_finished' : 'analysis_finished_without_pitch',
    });

    return { timeline };
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

  private async capturePitchContourWeb(durationMs: number, segmentMs: number): Promise<{ detectedMidis: number[]; detectedFrequencies: number[] } | null> {
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

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const start = segment * safeSegmentMs;
      const end = start + safeSegmentMs;
      const inWindow = timeline.filter((p) => p.timeMs >= start && p.timeMs < end).map((p) => p.frequency);
      if (inWindow.length > 0) {
        detectedFrequencies.push(median(inWindow));
      }
    }

    if (detectedFrequencies.length === 0) return null;

    return { detectedFrequencies, detectedMidis: detectedFrequencies.map((f) => noteFromPitch(f)) };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async capturePitchSample(durationMs: number): Promise<{ detectedFrequency: number; detectedMidi: number; noteName: string | null } | null> {
    if (Platform.OS === 'web') {
      return this.capturePitchSampleWeb(Math.max(500, durationMs));
    }

    const captureMs = Math.max(500, durationMs);
    const { timeline } = await this.streamPitchNative(captureMs);
    const frequencies = timeline.map((point) => point.frequency);

    if (frequencies.length === 0) return null;

    const detectedFrequency = median(frequencies);
    const detectedMidi = noteFromPitch(detectedFrequency);
    const noteName = midiToScientific(detectedMidi);

    return { detectedFrequency, detectedMidi, noteName };
  }

  async capturePitchContour(durationMs: number, segmentMs: number): Promise<{ detectedMidis: number[]; detectedFrequencies: number[] } | null> {
    if (Platform.OS === 'web') {
      return this.capturePitchContourWeb(Math.max(1000, durationMs), segmentMs);
    }

    const captureMs = Math.max(1000, durationMs);
    const { timeline } = await this.streamPitchNative(captureMs);

    if (timeline.length === 0) return null;

    const safeSegmentMs = Math.max(250, segmentMs);
    const totalDurationMs = Math.max(safeSegmentMs, captureMs);
    const segmentCount = Math.max(1, Math.round(totalDurationMs / safeSegmentMs));
    const detectedFrequencies: number[] = [];

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const start = segment * safeSegmentMs;
      const end = start + safeSegmentMs;
      const inWindow = timeline
        .filter((point) => point.timeMs >= start && point.timeMs < end)
        .map((point) => point.frequency);

      if (inWindow.length === 0) continue;

      detectedFrequencies.push(median(inWindow));
    }

    if (detectedFrequencies.length === 0) return null;

    return {
      detectedFrequencies,
      detectedMidis: detectedFrequencies.map((frequency) => noteFromPitch(frequency)),
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
