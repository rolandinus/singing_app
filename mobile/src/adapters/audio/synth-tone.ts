const SAMPLE_RATE = 44_100;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MAX_INT16 = 32_767;

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function envelopeAt(time: number, durationSeconds: number): number {
  const attack = Math.min(0.008, durationSeconds * 0.08);
  const decay = Math.min(0.09, Math.max(0.03, durationSeconds * 0.2));
  const sustain = 0.72;
  const release = Math.min(0.12, Math.max(0.045, durationSeconds * 0.14));
  const releaseStart = Math.max(attack + decay, durationSeconds - release);

  if (time < attack) {
    return clamp(time / Math.max(attack, 0.001), 0, 1);
  }

  if (time < attack + decay) {
    const progress = (time - attack) / Math.max(decay, 0.001);
    return 1 - progress * (1 - sustain);
  }

  if (time < releaseStart) {
    return sustain;
  }

  const releaseProgress = (time - releaseStart) / Math.max(durationSeconds - releaseStart, 0.001);
  return sustain * (1 - clamp(releaseProgress, 0, 1));
}

function harmonicGainFor(frequency: number, harmonic: number): number {
  const lowBoost = clamp((260 - frequency) / 180, 0, 1);
  const baseWeights = [1, 0.52, 0.26, 0.14, 0.08, 0.05];
  const lowNoteBoosts = [0.12, 0.28, 0.18, 0.08, 0.04, 0.02];
  const base = baseWeights[harmonic - 1] ?? 0;
  const boost = lowNoteBoosts[harmonic - 1] ?? 0;
  return base + boost * lowBoost;
}

function bodyGainForFrequency(frequency: number): number {
  const lowBoost = clamp((240 - frequency) / 160, 0, 1);
  const highTrim = clamp((frequency - 660) / 880, 0, 1) * 0.08;
  return 0.72 + lowBoost * 0.26 - highTrim;
}

function attackBrightness(time: number): number {
  if (time >= 0.06) return 0;
  return 1 - time / 0.06;
}

export function renderSynthTonePcm(frequency: number, durationMs = 650): Int16Array {
  const safeFrequency = clamp(frequency, 40, 2_000);
  const durationSeconds = Math.max(durationMs, 80) / 1000;
  const sampleCount = Math.max(1, Math.floor(durationSeconds * SAMPLE_RATE));
  const pcm = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    const envelope = envelopeAt(time, durationSeconds);
    const bodyGain = bodyGainForFrequency(safeFrequency);
    const brightness = attackBrightness(time);

    let sample = 0;
    for (let harmonic = 1; harmonic <= 6; harmonic += 1) {
      const gain = harmonicGainFor(safeFrequency, harmonic);
      const partial = Math.sin(2 * Math.PI * safeFrequency * harmonic * time);
      const brightAccent = harmonic >= 3 ? 1 + brightness * 0.35 : 1;
      sample += partial * gain * brightAccent;
    }

    const normalized = Math.tanh(sample * 0.68) * envelope * bodyGain;
    pcm[i] = Math.round(clamp(normalized, -1, 1) * MAX_INT16);
  }

  return pcm;
}

export function buildSynthToneWavDataUri(frequency: number, durationMs = 650): string {
  const pcmSamples = renderSynthTonePcm(frequency, durationMs);
  const dataSize = pcmSamples.length * CHANNELS * 2;
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
  view.setUint16(offset, CHANNELS, true); offset += 2;
  view.setUint32(offset, SAMPLE_RATE, true); offset += 4;
  view.setUint32(offset, SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), true); offset += 4;
  view.setUint16(offset, CHANNELS * (BITS_PER_SAMPLE / 8), true); offset += 2;
  view.setUint16(offset, BITS_PER_SAMPLE, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true); offset += 4;

  for (let i = 0; i < pcmSamples.length; i += 1) {
    view.setInt16(offset, pcmSamples[i] ?? 0, true);
    offset += 2;
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
}
