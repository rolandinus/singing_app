const NOTE_STRINGS_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const LETTER_TO_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

export function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function midiToScientific(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_STRINGS_SHARP[midi % 12];
  return `${note}${octave}`;
}

export function scientificToMidi(scientific) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(scientific);
  if (!match) {
    return null;
  }

  const [, letter, accidental, octaveRaw] = match;
  const octave = Number.parseInt(octaveRaw, 10);
  let semitone = NOTE_STRINGS_SHARP.indexOf(letter);

  if (accidental === "#") {
    semitone += 1;
  } else if (accidental === "b") {
    semitone -= 1;
  }

  semitone = (semitone + 12) % 12;
  return semitone + (octave + 1) * 12;
}

export function scientificToDiatonicIndex(scientific) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(scientific);
  if (!match) {
    return null;
  }

  const [, letter, , octaveRaw] = match;
  const octave = Number.parseInt(octaveRaw, 10);
  const letterIndex = LETTER_TO_INDEX[letter];

  if (letterIndex === undefined) {
    return null;
  }

  return octave * 7 + letterIndex;
}

export function noteLetter(scientific) {
  const match = /^([A-G])/.exec(scientific);
  return match ? match[1] : null;
}

export function isNaturalMidi(midi) {
  const scientific = midiToScientific(midi);
  return scientific !== null && !scientific.includes("#");
}

export function midiDifferenceToCents(midiDifference) {
  return midiDifference * 100;
}

export function getNaturalMidiPool(minMidi, maxMidi) {
  const pool = [];
  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (isNaturalMidi(midi)) {
      pool.push(midi);
    }
  }
  return pool;
}

export function buildDistractorChoices(correctValue, allValues, count = 4) {
  const unique = Array.from(new Set(allValues.filter((value) => value !== correctValue)));
  const shuffled = unique.sort(() => Math.random() - 0.5);
  const distractors = shuffled.slice(0, Math.max(0, count - 1));
  const withCorrect = [correctValue, ...distractors];
  return withCorrect.sort(() => Math.random() - 0.5);
}
