export function autoCorrelate(buffer, sampleRate) {
  let size = buffer.length;
  let sumOfSquares = 0;

  for (let i = 0; i < size; i += 1) {
    const value = buffer[i];
    sumOfSquares += value * value;
  }

  const rootMeanSquare = Math.sqrt(sumOfSquares / size);
  if (rootMeanSquare < 0.01) {
    return -1;
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
    return -1;
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
    return -1;
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
    return -1;
  }

  const x1 = correlation[t0 - 1];
  const x2 = correlation[t0];
  const x3 = correlation[t0 + 1];

  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;

  if (a) {
    t0 -= b / (2 * a);
  }

  return sampleRate / t0;
}

export function noteFromPitch(frequency) {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

export function midiToNoteName(midiNumber, noteStrings) {
  if (midiNumber < 0 || midiNumber > 127) {
    return null;
  }

  const octave = Math.floor(midiNumber / 12) - 1;
  const noteName = noteStrings[midiNumber % 12];
  return `${noteName}${octave}`;
}
