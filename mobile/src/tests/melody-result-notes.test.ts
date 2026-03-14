import { describe, expect, it } from 'vitest';
import { buildMelodyResultRenderNotes } from '../core/utils/melody-result-notes';

describe('melody result notes', () => {
  it('renders detected notes into their original melody slots', () => {
    expect(buildMelodyResultRenderNotes([
      { noteIndex: 0, detectedMidi: 60, correct: true },
      { noteIndex: 1, detectedMidi: 64, correct: false },
    ], ['quarter', 'half'])).toEqual([
      { note: 'C4', duration: 'quarter', slotIndex: 0, correct: true },
      { note: 'E4', duration: 'half', slotIndex: 1, correct: false },
    ]);
  });

  it('skips missing detected notes', () => {
    expect(buildMelodyResultRenderNotes([
      { noteIndex: 0, detectedMidi: null, correct: false },
      { noteIndex: 1, detectedMidi: 62, correct: true },
    ], ['quarter', 'quarter'])).toEqual([
      { note: 'D4', duration: 'quarter', slotIndex: 1, correct: true },
    ]);
  });
});
