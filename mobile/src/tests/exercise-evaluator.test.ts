import { describe, expect, it } from 'vitest';
import { ExerciseEvaluator } from '../core/domain/exercise-evaluator';
import type { Exercise } from '../core/types';

function makeMelodyExercise(targetMidis: number[], minAccuracy = 0.65): Exercise {
  return {
    id: 'melody-1',
    family: 'singing',
    skillKey: 'sing_melody',
    level: 2,
    clef: 'treble',
    prompt: { type: 'sing_melody', notes: ['C4', 'D4', 'E4'] },
    choices: [],
    expectedAnswer: { targetMidis, minAccuracy },
    metadata: {},
  };
}

describe('ExerciseEvaluator melody', () => {
  it('accepts a close melody contour', () => {
    const evaluator = new ExerciseEvaluator();
    const exercise = makeMelodyExercise([60, 62, 64], 0.6);

    const result = evaluator.evaluate(
      exercise,
      { detectedMidis: [60, 62, 64] },
      { toleranceCents: 50 },
    );

    expect(result.correct).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it('rejects a far melody contour', () => {
    const evaluator = new ExerciseEvaluator();
    const exercise = makeMelodyExercise([60, 62, 64], 0.6);

    const result = evaluator.evaluate(
      exercise,
      { detectedMidis: [67, 69, 71] },
      { toleranceCents: 50 },
    );

    expect(result.correct).toBe(false);
    expect(result.score).toBeLessThan(0.4);
  });
});
