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

export function renderSynthTonePcm(frequency: number, durationMs = 650): Int16Array {
  const safeFrequency = clamp(frequency, 40, 2_000);
  const durationSeconds = Math.max(durationMs, 80) / 1000;
  const sampleCount = Math.max(1, Math.floor(durationSeconds * SAMPLE_RATE));
  const pcm = new Int16Array(sampleCount);

  const lowBoost = clamp((240 - safeFrequency) / 160, 0, 1);
  const highTrim = clamp((safeFrequency - 660) / 880, 0, 1) * 0.08;
  const bodyGain = 0.72 + lowBoost * 0.26 - highTrim;

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    const envelope = envelopeAt(time, durationSeconds);
    const brightness = time < 0.06 ? 1 - time / 0.06 : 0;

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

/**
 * Render a metronome click PCM buffer modelled after the browser app's Tone.js
 * MembraneSynth.  Key characteristics:
 *   - Instantaneous pitch starts `octaves` above the base frequency and decays
 *     exponentially to the base frequency over `pitchDecay` seconds.
 *   - Amplitude follows a short attack → exponential decay → silence shape.
 *   - A band-limited noise burst in the first ~4 ms adds a sharp transient click.
 *
 * Parameters match the browser MembraneSynth defaults:
 *   pitchDecay 0.008 s, octaves 2, attack 0.001 s, decay 0.3 s
 */
export function renderMetronomeClickPcm(baseFrequency: number, accent = false, durationMs = 90): Int16Array {
  const freq = clamp(baseFrequency, 40, 4_000);
  const octaves = 2;
  const durationSeconds = Math.max(60, durationMs) / 1000;
  const pitchDecay = Math.min(0.008, Math.max(0.004, durationSeconds * 0.18));
  const attackTime = 0.001;
  const releaseTail = Math.min(0.02, Math.max(0.008, durationSeconds * 0.12));
  const decayTime = Math.max(0.025, durationSeconds - attackTime - releaseTail);
  const sampleCount = Math.ceil(durationSeconds * SAMPLE_RATE);
  const pcm = new Int16Array(sampleCount);

  let phase = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / SAMPLE_RATE;

    // Amplitude envelope: attack → exponential decay
    let amp: number;
    if (t < attackTime) {
      amp = t / attackTime;
    } else {
      const k = 10 / decayTime;
      amp = Math.exp(-k * (t - attackTime));
    }

    // Instantaneous frequency: exponential pitch sweep
    // f(t) = freq * 2^(octaves * e^(-t/pitchDecay))
    const freqNow = freq * Math.pow(2, octaves * Math.exp(-t / pitchDecay));
    phase += (2 * Math.PI * freqNow) / SAMPLE_RATE;

    const osc = Math.sin(phase);
    const noiseAmt = t < 0.004 ? (1 - t / 0.004) * 0.35 : 0;
    const noise = (Math.random() * 2 - 1) * noiseAmt;

    const gain = accent ? 0.82 : 0.65;
    pcm[i] = Math.round(clamp(Math.tanh((osc + noise) * amp * gain * 1.1), -1, 1) * MAX_INT16);
  }

  return pcm;
}

function buildWavDataUri(pcmSamples: Int16Array): string {
  const dataSize = pcmSamples.length * CHANNELS * 2;
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
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
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
    view.setInt16(offset, pcmSamples[i], true);
    offset += 2;
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

export function buildMetronomeClickWavDataUri(baseFrequency: number, accent = false, durationMs = 90): string {
  return buildWavDataUri(renderMetronomeClickPcm(baseFrequency, accent, durationMs));
}

export function buildSynthToneWavDataUri(frequency: number, durationMs = 650): string {
  return buildWavDataUri(renderSynthTonePcm(frequency, durationMs));
}
