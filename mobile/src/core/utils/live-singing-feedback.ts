import { midiToScientific } from './note-helpers';
import { noteFromPitch } from './pitch';

const SEMITONES_BY_NOTE = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const;

function scientificToMidi(scientific: string): number | null {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(scientific.trim());
  if (!match) return null;

  const [, note, accidental, octaveText] = match;
  const base = SEMITONES_BY_NOTE[note as keyof typeof SEMITONES_BY_NOTE];
  const accidentalOffset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const octave = Number(octaveText);
  if (!Number.isFinite(octave)) return null;

  return (octave + 1) * 12 + base + accidentalOffset;
}

export function detectedScientificFromFrequency(frequency: number | null | undefined): string | null {
  if (!Number.isFinite(frequency) || !frequency || frequency <= 0) return null;
  return midiToScientific(noteFromPitch(frequency));
}

export function activeSingingTargetIndex(
  skillKey: 'sing_note' | 'sing_interval' | 'sing_melody',
  isCapturing: boolean,
  promptNotesCount: number,
  singingNoteIndex: number | null,
): number | null {
  if (!isCapturing || promptNotesCount === 0) return null;
  if (skillKey === 'sing_note') return 0;
  if (singingNoteIndex === null) return null;
  return singingNoteIndex >= 0 && singingNoteIndex < promptNotesCount ? singingNoteIndex : null;
}

export function buildLiveSingingFeedback(input: {
  skillKey: 'sing_note' | 'sing_interval' | 'sing_melody';
  isCapturing: boolean;
  promptNotes: string[];
  singingNoteIndex: number | null;
  frequency: number | null | undefined;
}): {
  detectedNote: string | null;
  targetIndex: number | null;
  isOffTarget: boolean;
  correctionDirection: 'up' | 'down' | null;
} {
  const detectedNote = detectedScientificFromFrequency(input.frequency);
  const targetIndex = activeSingingTargetIndex(
    input.skillKey,
    input.isCapturing,
    input.promptNotes.length,
    input.singingNoteIndex,
  );
  const targetNote = targetIndex === null ? null : input.promptNotes[targetIndex] ?? null;
  const detectedMidi = detectedNote ? scientificToMidi(detectedNote) : null;
  const targetMidi = targetNote ? scientificToMidi(targetNote) : null;
  const isOffTarget = detectedMidi !== null && targetMidi !== null && detectedMidi !== targetMidi;
  const correctionDirection = isOffTarget
    ? (detectedMidi < targetMidi ? 'up' : 'down')
    : null;

  return {
    detectedNote,
    targetIndex,
    isOffTarget,
    correctionDirection,
  };
}
