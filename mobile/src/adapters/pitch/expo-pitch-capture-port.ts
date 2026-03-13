import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { Platform } from 'react-native';
import { midiToScientific } from '../../core/utils/note-helpers';
import { autoCorrelate, noteFromPitch } from '../../core/utils/pitch';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

type PitchTimelinePoint = { timeMs: number; frequency: number };
type RecorderCtor = new (options?: Partial<RecordingOptions>) => AudioRecorder;
type RecorderStatus = {
  isRecording?: boolean;
  durationMillis?: number;
  metering?: number;
};

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

const WEB_POLYFILLED_RECORDING_OPTIONS: Partial<RecordingOptions> = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  web: {
    ...(RecordingPresets.HIGH_QUALITY.web ?? {}),
    mimeType: 'audio/wav',
  },
};

export class ExpoPitchCapturePort {
  private activeRecording: AudioRecorder | null = null;
  private analysisPlayer: AudioPlayer | null = null;
  private debugListener: PitchCaptureDebugListener = null;

  private recordingOptions(): Partial<RecordingOptions> {
    const base = Platform.OS === 'web' ? WEB_POLYFILLED_RECORDING_OPTIONS : RecordingPresets.HIGH_QUALITY;
    return {
      ...base,
      isMeteringEnabled: true,
    };
  }

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

  private recorderStatusSnapshot(status: RecorderStatus): Pick<PitchCaptureDebugSnapshot, 'isRecording' | 'durationMillis' | 'metering'> {
    const meteringCandidate = Number(status.metering);
    const durationCandidate = Number(status.durationMillis);

    return {
      isRecording: Boolean(status.isRecording),
      durationMillis: Number.isFinite(durationCandidate) ? durationCandidate : 0,
      metering: Number.isFinite(meteringCandidate) ? meteringCandidate : null,
    };
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

  private async configureAudioModeForPlayback() {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });
  }

  private createRecorder(): AudioRecorder {
    const moduleWithRecorder = AudioModule as unknown as {
      AudioRecorder?: RecorderCtor;
      AudioRecorderWeb?: RecorderCtor;
    };
    const Recorder = moduleWithRecorder.AudioRecorder ?? moduleWithRecorder.AudioRecorderWeb;

    if (!Recorder) {
      throw new Error('Audio recorder is unavailable on this platform.');
    }

    return new Recorder(this.recordingOptions());
  }

  private async recordFor(durationMs: number): Promise<string | null> {
    await this.stop();
    await this.ensurePermissions();
    await this.configureAudioModeForRecording();

    const recorder = this.createRecorder();
    this.activeRecording = recorder;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    try {
      await recorder.prepareToRecordAsync(this.recordingOptions());
      this.emitDebug({
        phase: 'recording',
        ...this.recorderStatusSnapshot(recorder.getStatus() as RecorderStatus),
        message: 'recording_started',
      });
      recorder.record();
      pollInterval = setInterval(() => {
        try {
          const status = recorder.getStatus() as RecorderStatus;
          this.emitDebug({
            phase: 'recording',
            ...this.recorderStatusSnapshot(status),
          });
        } catch {}
      }, 120);
      await sleep(durationMs);
      await recorder.stop();
      let statusAfterStop: RecorderStatus = {};
      try {
        statusAfterStop = recorder.getStatus() as RecorderStatus;
      } catch {}
      this.emitDebug({
        phase: 'recorded',
        ...this.recorderStatusSnapshot(statusAfterStop),
        uri: recorder.uri ?? null,
        message: 'recording_finished',
      });
    } catch (error) {
      this.emitDebug({
        phase: 'error',
        message: error instanceof Error ? error.message : 'recording_failed',
      });
      throw error;
    } finally {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      this.activeRecording = null;
    }

    return recorder.uri;
  }

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

  async capturePitchSample(durationMs: number): Promise<{ detectedFrequency: number; detectedMidi: number; noteName: string | null } | null> {
    if (Platform.OS === 'web') {
      return this.capturePitchSampleWeb(Math.max(500, durationMs));
    }

    const uri = await this.recordFor(Math.max(500, durationMs));
    if (!uri) {
      return null;
    }

    const analysis = await this.analyzeRecording(uri, Math.max(4000, durationMs + 1500));
    const frequencies = analysis.timeline.map((point) => point.frequency);

    if (frequencies.length === 0) {
      return null;
    }

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
    const uri = await this.recordFor(captureMs);
    if (!uri) {
      return null;
    }

    const analysis = await this.analyzeRecording(uri, Math.max(4500, captureMs + 1500));
    if (analysis.timeline.length === 0) {
      return null;
    }

    const safeSegmentMs = Math.max(250, segmentMs);
    const totalDurationMs = Math.max(safeSegmentMs, analysis.durationMs);
    const segmentCount = Math.max(1, Math.round(totalDurationMs / safeSegmentMs));
    const detectedFrequencies: number[] = [];

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const start = segment * safeSegmentMs;
      const end = start + safeSegmentMs;
      const inWindow = analysis.timeline
        .filter((point) => point.timeMs >= start && point.timeMs < end)
        .map((point) => point.frequency);

      if (inWindow.length === 0) {
        continue;
      }

      detectedFrequencies.push(median(inWindow));
    }

    if (detectedFrequencies.length === 0) {
      return null;
    }

    return {
      detectedFrequencies,
      detectedMidis: detectedFrequencies.map((frequency) => noteFromPitch(frequency)),
    };
  }

  private async analyzeRecording(uri: string, timeoutMs: number): Promise<{ timeline: PitchTimelinePoint[]; durationMs: number }> {
    await this.configureAudioModeForPlayback();
    this.emitDebug({
      phase: 'analyzing',
      uri,
      message: 'analysis_started',
    });

    const timeline: PitchTimelinePoint[] = [];
    let startedAt = 0;
    let lastSampleDebugMs = 0;

    const player = createAudioPlayer({ uri }, { updateInterval: 50 });
    this.analysisPlayer = player;

    const sampleSubscription = player.addListener('audioSampleUpdate', (sample) => {
      const frames = sample.channels[0]?.frames;
      if (!frames || frames.length < 256) {
        return;
      }

      const frequency = autoCorrelate(Float32Array.from(frames), 44_100);
      if (!Number.isFinite(frequency) || frequency <= 0) {
        return;
      }

      if (frequency < 60 || frequency > 1200) {
        return;
      }

      if (!startedAt) {
        startedAt = Date.now();
      }

      timeline.push({
        timeMs: Math.max(0, Date.now() - startedAt),
        frequency,
      });

      const now = Date.now();
      if (now - lastSampleDebugMs >= 120) {
        const latest = timeline[timeline.length - 1];
        this.emitDebug({
          phase: 'analysis_sample',
          frequency: latest?.frequency ?? null,
          sampleTimeMs: latest?.timeMs ?? 0,
          timelinePoints: timeline.length,
        });
        lastSampleDebugMs = now;
      }
    });

    player.setAudioSamplingEnabled(true);

    try {
      await new Promise<void>((resolve) => {
        let settled = false;

        const done = () => {
          if (!settled) {
            settled = true;
            statusSubscription.remove();
            resolve();
          }
        };

        const statusSubscription = player.addListener('playbackStatusUpdate', (status) => {
          if (!status.isLoaded || status.didJustFinish) {
            done();
          }
        });

        setTimeout(done, timeoutMs);

        try {
          player.play();
        } catch {
          done();
        }
      });
    } finally {
      sampleSubscription.remove();
      try {
        player.pause();
      } catch {}
      try {
        player.remove();
      } catch {}
      this.analysisPlayer = null;
    }

    const durationMs = timeline.length > 0 ? timeline[timeline.length - 1].timeMs : 0;
    this.emitDebug({
      phase: 'analysis_complete',
      timelinePoints: timeline.length,
      durationMillis: durationMs,
      frequency: timeline.length > 0 ? timeline[timeline.length - 1].frequency : null,
      message: timeline.length > 0 ? 'analysis_finished' : 'analysis_finished_without_pitch',
    });
    return { timeline, durationMs };
  }

  async stop(): Promise<void> {
    if (this.activeRecording) {
      try {
        await this.activeRecording.stop();
      } catch {}
      this.activeRecording = null;
    }

    if (this.analysisPlayer) {
      try {
        this.analysisPlayer.pause();
      } catch {}
      try {
        this.analysisPlayer.remove();
      } catch {}
      this.analysisPlayer = null;
    }

    this.emitDebug({
      phase: 'idle',
      message: 'stopped',
    });
  }
}
