import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { midiToScientific } from '../../core/utils/note-helpers';
import { autoCorrelate, noteFromPitch } from '../../core/utils/pitch';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSoundCompletion(sound: Audio.Sound): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || status.didJustFinish) {
        done();
      }
    });

    setTimeout(done, 4000);
  });
}

type PitchTimelinePoint = { timeMs: number; frequency: number };

export class ExpoPitchCapturePort {
  private activeRecording: Audio.Recording | null = null;
  private analysisSound: Audio.Sound | null = null;

  private async ensurePermissions() {
    const existing = await Audio.getPermissionsAsync();
    if (!existing.granted) {
      const requested = await Audio.requestPermissionsAsync();
      if (!requested.granted) {
        throw new Error('Mikrofonberechtigung wurde nicht erteilt.');
      }
    }
  }

  private async configureAudioModeForRecording() {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
  }

  private async configureAudioModeForPlayback() {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
  }

  async capturePitchSample(durationMs: number): Promise<{ detectedFrequency: number; detectedMidi: number; noteName: string | null } | null> {
    await this.stop();
    await this.ensurePermissions();
    await this.configureAudioModeForRecording();

    const recording = new Audio.Recording();
    this.activeRecording = recording;

    try {
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      await sleep(Math.max(500, durationMs));
      await recording.stopAndUnloadAsync();
    } finally {
      this.activeRecording = null;
    }

    const uri = recording.getURI();
    if (!uri) {
      return null;
    }

    const analysis = await this.analyzeRecording(uri);
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
    await this.stop();
    await this.ensurePermissions();
    await this.configureAudioModeForRecording();

    const recording = new Audio.Recording();
    this.activeRecording = recording;

    try {
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      await sleep(Math.max(1000, durationMs));
      await recording.stopAndUnloadAsync();
    } finally {
      this.activeRecording = null;
    }

    const uri = recording.getURI();
    if (!uri) {
      return null;
    }

    const analysis = await this.analyzeRecording(uri);
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

  private async analyzeRecording(uri: string): Promise<{ timeline: PitchTimelinePoint[]; durationMs: number }> {
    await this.configureAudioModeForPlayback();
    const timeline: PitchTimelinePoint[] = [];
    let startedAt = 0;

    const sound = new Audio.Sound();
    this.analysisSound = sound;
    sound.setOnAudioSampleReceived((sample) => {
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
    });

    try {
      await sound.loadAsync({ uri }, { shouldPlay: true, isMuted: true, volume: 0 });
      await waitForSoundCompletion(sound);
    } finally {
      try {
        await sound.unloadAsync();
      } catch {}
      this.analysisSound = null;
    }

    const durationMs = timeline.length > 0 ? timeline[timeline.length - 1].timeMs : 0;
    return { timeline, durationMs };
  }

  async stop(): Promise<void> {
    if (this.activeRecording) {
      try {
        await this.activeRecording.stopAndUnloadAsync();
      } catch {}
      this.activeRecording = null;
    }

    if (this.analysisSound) {
      try {
        await this.analysisSound.stopAsync();
      } catch {}
      try {
        await this.analysisSound.unloadAsync();
      } catch {}
      this.analysisSound = null;
    }
  }
}
