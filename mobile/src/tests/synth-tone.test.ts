import { describe, expect, it } from 'vitest';
import { buildSynthToneWavDataUri, renderSynthTonePcm } from '../adapters/audio/synth-tone';

function decodeWavDataUri(uri: string): Buffer {
  const prefix = 'data:audio/wav;base64,';
  expect(uri.startsWith(prefix)).toBe(true);
  return Buffer.from(uri.slice(prefix.length), 'base64');
}

function readPcmSamplesFromWav(buffer: Buffer): Int16Array {
  const pcmBytes = buffer.subarray(44);
  return new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, Math.floor(pcmBytes.byteLength / 2));
}

function rms(samples: Int16Array, startRatio = 0.2, endRatio = 0.85): number {
  const start = Math.floor(samples.length * startRatio);
  const end = Math.max(start + 1, Math.floor(samples.length * endRatio));
  let sumSquares = 0;

  for (let i = start; i < end; i += 1) {
    const value = samples[i] ?? 0;
    sumSquares += value * value;
  }

  return Math.sqrt(sumSquares / Math.max(1, end - start));
}

describe('synth tone renderer', () => {
  it('builds a valid wav data uri with pcm payload', () => {
    const uri = buildSynthToneWavDataUri(261.63, 400);
    const wav = decodeWavDataUri(uri);

    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(readPcmSamplesFromWav(wav).length).toBeGreaterThan(10_000);
  });

  it('keeps rendered samples within 16-bit pcm bounds', () => {
    const frequencies = [130.81, 261.63, 523.25, 987.77];

    for (const frequency of frequencies) {
      const samples = renderSynthTonePcm(frequency, 500);
      let maxAbs = 0;
      for (const sample of samples) {
        maxAbs = Math.max(maxAbs, Math.abs(sample));
      }
      expect(maxAbs).toBeLessThanOrEqual(32_767);
      expect(maxAbs).toBeGreaterThan(2_000);
    }
  });

  it('keeps low notes clearly audible relative to the mid register', () => {
    const low = renderSynthTonePcm(130.81, 650);
    const mid = renderSynthTonePcm(261.63, 650);
    const high = renderSynthTonePcm(523.25, 650);

    const lowRms = rms(low);
    const midRms = rms(mid);
    const highRms = rms(high);

    expect(lowRms / midRms).toBeGreaterThan(0.95);
    expect(lowRms / highRms).toBeGreaterThan(1.2);
  });
});
