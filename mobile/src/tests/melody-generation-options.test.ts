import { describe, expect, it } from 'vitest';
import { DEFAULT_MELODY_OPTIONS, ExerciseGenerator } from '../core/domain/exercise-generator';
import { SessionService } from '../core/services/session-service';
import { DEFAULT_SETTINGS } from '../core/config/curriculum';
import type { MelodyOptions } from '../core/types';

// ---------------------------------------------------------------------------
// ExerciseGenerator – melody options respected
// ---------------------------------------------------------------------------

describe('ExerciseGenerator – melody options', () => {
  it('exports DEFAULT_MELODY_OPTIONS with sensible defaults', () => {
    expect(DEFAULT_MELODY_OPTIONS.firstNoteMode).toBe('random');
    expect(DEFAULT_MELODY_OPTIONS.allowedIntervalSteps.length).toBeGreaterThan(0);
  });

  it('generates sing_melody with default options when none supplied', () => {
    const g = new ExerciseGenerator();
    const ex = g.generate({ skillKey: 'sing_melody', clef: 'treble', level: 2 });

    expect(ex.skillKey).toBe('sing_melody');
    expect(Array.isArray((ex.prompt as any).notes)).toBe(true);
    expect((ex.prompt as any).notes.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray((ex.expectedAnswer as any).targetMidis)).toBe(true);

    // Metadata should record which settings were applied.
    expect(ex.metadata.melodyFirstNoteMode).toBe('random');
    expect(Array.isArray(ex.metadata.melodyAllowedIntervalSteps)).toBe(true);
  });

  it('records firstNoteMode=C4 in metadata when explicitly requested', () => {
    const g = new ExerciseGenerator();
    const options: MelodyOptions = { firstNoteMode: 'C4', allowedIntervalSteps: [1, 2] };
    const ex = g.generate({ skillKey: 'sing_melody', clef: 'treble', level: 1, melodyOptions: options });

    expect(ex.metadata.melodyFirstNoteMode).toBe('C4');
  });

  it('records firstNoteMode=C2 in metadata when explicitly requested', () => {
    const g = new ExerciseGenerator();
    const options: MelodyOptions = { firstNoteMode: 'C2', allowedIntervalSteps: [1, 2, 3] };
    const ex = g.generate({ skillKey: 'sing_melody', clef: 'bass', level: 2, melodyOptions: options });

    expect(ex.metadata.melodyFirstNoteMode).toBe('C2');
  });

  it('records allowedIntervalSteps in metadata', () => {
    const g = new ExerciseGenerator();
    const options: MelodyOptions = { firstNoteMode: 'random', allowedIntervalSteps: [2, 4] };
    const ex = g.generate({ skillKey: 'sing_melody', clef: 'treble', level: 3, melodyOptions: options });

    expect(ex.metadata.melodyAllowedIntervalSteps).toEqual([2, 4]);
  });

  it('generates a note sequence of the expected length at each level', () => {
    const g = new ExerciseGenerator();
    for (let level = 1; level <= 5; level += 1) {
      const ex = g.generate({ skillKey: 'sing_melody', clef: 'treble', level });
      const notes = (ex.prompt as any).notes as string[];
      const midis = (ex.expectedAnswer as any).targetMidis as number[];

      expect(notes.length).toBeGreaterThanOrEqual(3);
      expect(notes.length).toBeLessThanOrEqual(6);
      expect(notes.length).toBe(midis.length);
    }
  });

  it('falls back to default interval steps when allowedIntervalSteps is empty', () => {
    // An empty interval set would break generation; the generator must not throw.
    const g = new ExerciseGenerator();
    const options: MelodyOptions = { firstNoteMode: 'random', allowedIntervalSteps: [] };
    const ex = g.generate({ skillKey: 'sing_melody', clef: 'treble', level: 1, melodyOptions: options });

    const notes = (ex.prompt as any).notes as string[];
    expect(notes.length).toBeGreaterThanOrEqual(3);
  });

  it('does not alter non-melody exercises when melodyOptions is passed', () => {
    const g = new ExerciseGenerator();
    const options: MelodyOptions = { firstNoteMode: 'C4', allowedIntervalSteps: [1] };

    const noteEx = g.generate({ skillKey: 'note_naming', clef: 'treble', level: 1, melodyOptions: options });
    expect(noteEx.skillKey).toBe('note_naming');

    const intervalEx = g.generate({ skillKey: 'sing_interval', clef: 'treble', level: 2, melodyOptions: options });
    expect(intervalEx.skillKey).toBe('sing_interval');
  });
});

// ---------------------------------------------------------------------------
// SessionService – melody options flow from startCustomSession to generator
// ---------------------------------------------------------------------------

function createMockStorage() {
  const progress: Record<string, any> = {};
  const sessions: any[] = [];
  let settings = { ...DEFAULT_SETTINGS };

  return {
    async init() {},
    async loadSettings() { return settings; },
    async saveSettings(next: any) { settings = next; return settings; },
    async getAllProgress() { return Object.values(progress); },
    async saveProgress(record: any) { progress[record.skillKey] = record; return record; },
    async saveSession(session: any) { sessions.push(session); return session; },
    async getRecentSessions(limit = 20) { return sessions.slice(0, limit); },
  };
}

describe('SessionService – custom melody session with options', () => {
  it('starts a custom sing_melody session and exercises carry melody metadata', async () => {
    const service = new SessionService(createMockStorage());
    await service.init();

    const melodyOptions: MelodyOptions = { firstNoteMode: 'C4', allowedIntervalSteps: [1, 2, 3] };
    const started = service.startCustomSession({
      skillKey: 'sing_melody',
      clef: 'treble',
      level: 2,
      count: 3,
      melodyOptions,
    });

    expect(started.ok).toBe(true);

    const ex = service.getCurrentExercise();
    expect(ex?.skillKey).toBe('sing_melody');
    expect(ex?.metadata.melodyFirstNoteMode).toBe('C4');
    expect(ex?.metadata.melodyAllowedIntervalSteps).toEqual([1, 2, 3]);
  });

  it('uses default melody options when none are passed for sing_melody', async () => {
    const service = new SessionService(createMockStorage());
    await service.init();

    const started = service.startCustomSession({
      skillKey: 'sing_melody',
      clef: 'treble',
      level: 1,
      count: 1,
    });

    expect(started.ok).toBe(true);
    const ex = service.getCurrentExercise();
    expect(ex?.metadata.melodyFirstNoteMode).toBe('random');
  });

  it('all exercises in the queue carry the same melody options metadata', async () => {
    const service = new SessionService(createMockStorage());
    await service.init();

    const melodyOptions: MelodyOptions = { firstNoteMode: 'C2', allowedIntervalSteps: [2, 4] };
    service.startCustomSession({
      skillKey: 'sing_melody',
      clef: 'bass',
      level: 3,
      count: 4,
      melodyOptions,
    });

    // Advance through all exercises and check each one.
    for (let i = 0; i < 4; i += 1) {
      const ex = service.getCurrentExercise();
      expect(ex?.metadata.melodyFirstNoteMode).toBe('C2');
      expect(ex?.metadata.melodyAllowedIntervalSteps).toEqual([2, 4]);
      if (i < 3) await service.nextExercise();
    }
  });
});
