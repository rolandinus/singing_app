const NOTE_STRINGS_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function midiToScientific(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_STRINGS_SHARP[midi % 12];
  return `${note}${octave}`;
}

export function noteLetter(scientific: string): string | null {
  const match = /^([A-G])/.exec(scientific);
  return match ? match[1] : null;
}

export function isNaturalMidi(midi: number): boolean {
  const scientific = midiToScientific(midi);
  return !scientific.includes('#');
}

export function getNaturalMidiPool(minMidi: number, maxMidi: number): number[] {
  const pool: number[] = [];
  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (isNaturalMidi(midi)) {
      pool.push(midi);
    }
  }
  return pool;
}

export function buildDistractorChoices(correctValue: string, allValues: string[], count = 4): string[] {
  const unique = Array.from(new Set(allValues.filter((value) => value !== correctValue)));
  const shuffled = unique.sort(() => Math.random() - 0.5);
  const distractors = shuffled.slice(0, Math.max(0, count - 1));
  const withCorrect = [correctValue, ...distractors];
  return withCorrect.sort(() => Math.random() - 0.5);
}
