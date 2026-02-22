import { describe, expect, it } from 'vitest';
import { createDefaultProgressRecord, ProgressionEngine } from '../core/domain/progression-engine';

describe('ProgressionEngine', () => {
  it('levels up after rolling threshold', () => {
    const engine = new ProgressionEngine();
    let record = createDefaultProgressRecord('treble.note_naming');

    for (let i = 0; i < 20; i += 1) {
      const result = engine.applyEvaluation(record, {
        correct: true,
        score: 1,
        accuracyDetail: {},
        feedback: 'ok',
        telemetry: {},
      }, new Date().toISOString());
      record = result.record;
    }

    expect(record.level).toBe(2);
    expect(record.mastery).toBe(0);
  });
});
