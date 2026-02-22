import { describe, expect, it } from 'vitest';
import { ExerciseGenerator } from '../core/domain/exercise-generator';

describe('ExerciseGenerator', () => {
  it('generates note naming with 4 choices', () => {
    const g = new ExerciseGenerator();
    const ex = g.generate({ skillKey: 'note_naming', clef: 'treble', level: 1 });
    expect(ex.skillKey).toBe('note_naming');
    expect(ex.choices.length).toBe(4);
    expect(typeof (ex.prompt as any).note).toBe('string');
  });

  it('generates interval visual with two notes', () => {
    const g = new ExerciseGenerator();
    const ex = g.generate({ skillKey: 'interval_visual', clef: 'bass', level: 2 });
    expect(ex.skillKey).toBe('interval_visual');
    expect(typeof (ex.prompt as any).first).toBe('string');
    expect(typeof (ex.prompt as any).second).toBe('string');
  });
});
