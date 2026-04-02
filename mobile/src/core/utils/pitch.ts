export type AutoCorrelatePeak = {
  lag: number;
  frequency: number;
  correlation: number;
};

export type AutoCorrelateDiagnostics = {
  rms: number;
  trimmedSize: number;
  searchStartLag: number;
  bestLag: number;
  bestCorrelation: number;
  subharmonicLag: number | null;
  subharmonicFrequency: number | null;
  subharmonicCorrelation: number | null;
  subharmonicRatio: number | null;
  selectedLag: number | null;
  selectedFrequency: number | null;
  topPeaks: AutoCorrelatePeak[];
  reason: 'ok' | 'silent_input' | 'empty_trimmed_buffer' | 'descending_autocorrelation' | 'invalid_peak';
};

export type AutoCorrelateResult = {
  frequency: number;
  diagnostics: AutoCorrelateDiagnostics;
};

function autoCorrelateInternal(
  buffer: Float32Array,
  sampleRate: number,
): AutoCorrelateResult {
  let size = buffer.length;
  let sumOfSquares = 0;

  for (let i = 0; i < size; i += 1) {
    const value = buffer[i];
    sumOfSquares += value * value;
  }

  const rootMeanSquare = Math.sqrt(sumOfSquares / size);
  if (rootMeanSquare < 0.01) {
    return {
      frequency: -1,
      diagnostics: {
        rms: rootMeanSquare,
        trimmedSize: 0,
        searchStartLag: 0,
        bestLag: -1,
        bestCorrelation: -1,
        subharmonicLag: null,
        subharmonicFrequency: null,
        subharmonicCorrelation: null,
        subharmonicRatio: null,
        selectedLag: null,
        selectedFrequency: null,
        topPeaks: [],
        reason: 'silent_input',
      },
    };
  }

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;

  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buffer[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }

  const sliced = buffer.slice(r1, r2);
  size = sliced.length;
  if (size === 0) {
    return {
      frequency: -1,
      diagnostics: {
        rms: rootMeanSquare,
        trimmedSize: 0,
        searchStartLag: 0,
        bestLag: -1,
        bestCorrelation: -1,
        subharmonicLag: null,
        subharmonicFrequency: null,
        subharmonicCorrelation: null,
        subharmonicRatio: null,
        selectedLag: null,
        selectedFrequency: null,
        topPeaks: [],
        reason: 'empty_trimmed_buffer',
      },
    };
  }

  const correlation = new Array(size).fill(0);
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size - i; j += 1) {
      correlation[i] += sliced[j] * sliced[j + i];
    }
  }

  let d = 0;
  while (d < correlation.length - 1 && correlation[d] > correlation[d + 1]) {
    d += 1;
  }

  if (d === correlation.length - 1 && correlation.length > 1) {
    return {
      frequency: -1,
      diagnostics: {
        rms: rootMeanSquare,
        trimmedSize: size,
        searchStartLag: d,
        bestLag: -1,
        bestCorrelation: -1,
        subharmonicLag: null,
        subharmonicFrequency: null,
        subharmonicCorrelation: null,
        subharmonicRatio: null,
        selectedLag: null,
        selectedFrequency: null,
        topPeaks: [],
        reason: 'descending_autocorrelation',
      },
    };
  }

  let maxValue = -1;
  let maxIndex = -1;
  for (let i = d; i < size; i += 1) {
    if (correlation[i] > maxValue) {
      maxValue = correlation[i];
      maxIndex = i;
    }
  }

  let t0 = maxIndex;
  if (t0 <= 0 || t0 + 1 >= correlation.length) {
    return {
      frequency: -1,
      diagnostics: {
        rms: rootMeanSquare,
        trimmedSize: size,
        searchStartLag: d,
        bestLag: maxIndex,
        bestCorrelation: maxValue,
        subharmonicLag: null,
        subharmonicFrequency: null,
        subharmonicCorrelation: null,
        subharmonicRatio: null,
        selectedLag: null,
        selectedFrequency: null,
        topPeaks: [],
        reason: 'invalid_peak',
      },
    };
  }

  const x1 = correlation[t0 - 1];
  const x2 = correlation[t0];
  const x3 = correlation[t0 + 1];

  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) {
    t0 -= b / (2 * a);
  }

  const localMaxima: AutoCorrelatePeak[] = [];
  for (let i = Math.max(1, d); i < correlation.length - 1; i += 1) {
    if (correlation[i] > correlation[i - 1] && correlation[i] >= correlation[i + 1]) {
      localMaxima.push({
        lag: i,
        frequency: sampleRate / i,
        correlation: correlation[i],
      });
    }
  }
  const topPeaks = localMaxima.sort((aPeak, bPeak) => bPeak.correlation - aPeak.correlation).slice(0, 6);

  const subharmonicLag = Math.round(t0 * 2);
  const subharmonicCorrelation = subharmonicLag >= 0 && subharmonicLag < correlation.length
    ? correlation[subharmonicLag]
    : null;
  const subharmonicFrequency = subharmonicCorrelation == null ? null : sampleRate / subharmonicLag;
  const subharmonicRatio = subharmonicCorrelation != null && x2 > 0
    ? subharmonicCorrelation / x2
    : null;

  return {
    frequency: sampleRate / t0,
    diagnostics: {
      rms: rootMeanSquare,
      trimmedSize: size,
      searchStartLag: d,
      bestLag: maxIndex,
      bestCorrelation: maxValue,
      subharmonicLag: subharmonicCorrelation == null ? null : subharmonicLag,
      subharmonicFrequency,
      subharmonicCorrelation,
      subharmonicRatio,
      selectedLag: t0,
      selectedFrequency: sampleRate / t0,
      topPeaks,
      reason: 'ok',
    },
  };
}

export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  return autoCorrelateInternal(buffer, sampleRate).frequency;
}

export function autoCorrelateWithDiagnostics(buffer: Float32Array, sampleRate: number): AutoCorrelateResult {
  return autoCorrelateInternal(buffer, sampleRate);
}

export function noteFromPitch(frequency: number): number {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}
