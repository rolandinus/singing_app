import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

function scientificToMidi(note: string): number {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(String(note).trim());
  if (!match) {
    return 60;
  }

  const [, letter, sharp, octaveRaw] = match;
  const octave = Number(octaveRaw);
  const offsets: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitone = (offsets[letter] ?? 0) + (sharp ? 1 : 0);
  return (octave + 1) * 12 + semitone;
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const combined = (b0 << 16) | (b1 << 8) | b2;

    output += chars[(combined >> 18) & 0x3f];
    output += chars[(combined >> 12) & 0x3f];
    output += i + 1 < bytes.length ? chars[(combined >> 6) & 0x3f] : '=';
    output += i + 2 < bytes.length ? chars[combined & 0x3f] : '=';
  }

  return output;
}

function buildSineWaveWavDataUri(frequency: number, durationMs = 650): string {
  const sampleRate = 44_100;
  const channels = 1;
  const bitsPerSample = 16;
  const amplitude = 0.35;
  const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
  const fadeSamples = Math.floor(sampleRate * 0.01);
  const dataSize = sampleCount * channels * 2;
  const fileSize = 36 + dataSize;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
    offset += value.length;
  };

  writeString('RIFF');
  view.setUint32(offset, fileSize, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * channels * (bitsPerSample / 8), true); offset += 4;
  view.setUint16(offset, channels * (bitsPerSample / 8), true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true); offset += 4;

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / sampleRate;
    let envelope = 1;

    if (i < fadeSamples) envelope = i / fadeSamples;
    if (i > sampleCount - fadeSamples) envelope = (sampleCount - i) / fadeSamples;

    const sample = Math.sin(2 * Math.PI * frequency * time) * amplitude * envelope;
    const pcm = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, pcm * 32767, true);
    offset += 2;
  }

  const base64 = bytesToBase64(new Uint8Array(buffer));
  return `data:audio/wav;base64,${base64}`;
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
      if (!status.isLoaded) {
        done();
        return;
      }

      if (status.didJustFinish) {
        done();
      }
    });

    setTimeout(done, 2000);
  });
}

export class ExpoAudioPromptPort {
  private static configured = false;
  private activeSound: Audio.Sound | null = null;

  private async ensureAudioMode() {
    if (ExpoAudioPromptPort.configured) {
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });

    ExpoAudioPromptPort.configured = true;
  }

  private async playTone(note: string) {
    const midi = scientificToMidi(note);
    const frequency = midiToFrequency(midi);
    const uri = buildSineWaveWavDataUri(frequency);
    const created = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    this.activeSound = created.sound;
    await waitForSoundCompletion(created.sound);
    await created.sound.unloadAsync();
    this.activeSound = null;
  }

  async playInterval(first: string, second: string): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    await this.playTone(first);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await this.playTone(second);
  }

  async playNote(note: string): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    await this.playTone(note);
  }

  async playReferenceWithTarget(reference: string, target: string): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    await this.playTone(reference);
    await new Promise((resolve) => setTimeout(resolve, 220));
    await this.playTone(target);
  }

  async stop(): Promise<void> {
    if (!this.activeSound) {
      return;
    }

    const sound = this.activeSound;
    this.activeSound = null;

    try {
      await sound.stopAsync();
    } catch {}
    try {
      await sound.unloadAsync();
    } catch {}
  }
}
