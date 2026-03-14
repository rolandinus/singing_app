import { describe, expect, it } from 'vitest';
import {
  activeSingingTargetIndex,
  buildLiveSingingFeedback,
  detectedScientificFromFrequency,
} from '../core/utils/live-singing-feedback';

describe('live singing feedback', () => {
  it('converts a detected frequency to a scientific note name', () => {
    expect(detectedScientificFromFrequency(440)).toBe('A4');
  });

  it('keeps sing_note locked to the only target slot while capturing', () => {
    expect(activeSingingTargetIndex('sing_note', true, 1, null)).toBe(0);
  });

  it('uses the active highlight index for multi-note singing exercises', () => {
    expect(activeSingingTargetIndex('sing_interval', true, 2, 1)).toBe(1);
    expect(activeSingingTargetIndex('sing_melody', true, 4, 2)).toBe(2);
  });

  it('marks a live note as off-target when it differs from the active target note', () => {
    expect(buildLiveSingingFeedback({
      skillKey: 'sing_note',
      isCapturing: true,
      promptNotes: ['C4'],
      singingNoteIndex: null,
      frequency: 440,
    })).toEqual({
      detectedNote: 'A4',
      targetIndex: 0,
      isOffTarget: true,
      correctionDirection: 'down',
    });
  });

  it('does not mark a live note off-target when it matches the active target note', () => {
    expect(buildLiveSingingFeedback({
      skillKey: 'sing_interval',
      isCapturing: true,
      promptNotes: ['C4', 'E4'],
      singingNoteIndex: 1,
      frequency: 329.63,
    })).toEqual({
      detectedNote: 'E4',
      targetIndex: 1,
      isOffTarget: false,
      correctionDirection: null,
    });
  });
});
