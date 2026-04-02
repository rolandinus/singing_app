import type { NoteType } from '../types';
import { midiToScientific } from './note-helpers';

export type MelodyResultRenderNote = {
  note: string;
  duration: NoteType;
  slotIndex: number;
  correct: boolean;
  isOctaveOff: boolean;
};

export function buildMelodyResultRenderNotes(
  noteResults: Array<{ noteIndex: number; detectedMidi: number | null; correct: boolean; isOctaveOff?: boolean }>,
  durations: NoteType[],
): MelodyResultRenderNote[] {
  return noteResults
    .filter((result) => Number.isFinite(result.detectedMidi))
    .map((result) => ({
      note: midiToScientific(result.detectedMidi as number),
      duration: durations[result.noteIndex] ?? 'quarter',
      slotIndex: result.noteIndex,
      correct: result.correct,
      isOctaveOff: result.isOctaveOff ?? false,
    }));
}
