import { describe, expect, it } from 'vitest';
import { SessionService } from '../core/services/session-service';
import { DEFAULT_SETTINGS } from '../core/config/curriculum';

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

function midiToFrequency(midi: number): number {
  return 440 * (2 ** ((midi - 69) / 12));
}

describe('SessionService', () => {
  it('runs guided visual session end-to-end', async () => {
    const service = new SessionService(createMockStorage());
    await service.init();

    const started = service.startGuidedSession();
    expect(started.ok).toBe(true);

    const ex = service.getCurrentExercise();
    expect(ex).toBeTruthy();
    if (!ex) return;

    await service.submitChoice(String((ex.expectedAnswer as any).answer));
    const step = await service.nextExercise();
    expect(step.ok).toBe(true);

    const ended = await service.endSession();
    expect(ended?.summary.total).toBeGreaterThanOrEqual(1);
  });

  it('plays sing interval prompts through the interval playback path', async () => {
    const calls = {
      playInterval: [] as Array<[string, string]>,
      playReferenceWithTarget: [] as Array<[string, string]>,
    };
    const service = new SessionService(
      createMockStorage(),
      {
        async playNote() {},
        async playReferenceWithTarget(reference, target) {
          calls.playReferenceWithTarget.push([reference, target]);
        },
        async playInterval(first, second) {
          calls.playInterval.push([first, second]);
        },
        async playMelody() {},
        async stop() {},
      },
      {
        async capturePitchSample() { return null; },
        async capturePitchContour() { return null; },
        async stop() {},
      },
    );
    await service.init();

    const started = service.startCustomSession({
      skillKey: 'sing_interval',
      clef: 'treble',
      level: 1,
      count: 1,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const exercise = service.getCurrentExercise();
    expect(exercise?.skillKey).toBe('sing_interval');
    if (!exercise || exercise.skillKey !== 'sing_interval') return;

    await service.playPrompt();

    expect(calls.playInterval).toEqual([
      [String(exercise.prompt.reference), String(exercise.prompt.target)],
    ]);
    expect(calls.playReferenceWithTarget).toEqual([]);
  });

  it('ends custom session even when audio cleanup does not resolve', async () => {
    const never = new Promise<void>(() => {});
    const service = new SessionService(
      createMockStorage(),
      {
        async playNote() {},
        async playReferenceWithTarget() {},
        async playInterval() {},
        async playMelody() {},
        stop: () => never,
      },
      {
        async capturePitchSample() { return null; },
        async capturePitchContour() { return null; },
        stop: () => never,
      },
    );
    await service.init();

    const started = service.startCustomSession({
      skillKey: 'note_naming',
      clef: 'treble',
      level: 1,
      count: 3,
    });
    expect(started.ok).toBe(true);

    const result = await Promise.race([
      service.endSession().then((ended) => ({ kind: 'ended' as const, ended })),
      new Promise<{ kind: 'timeout' }>((resolve) => {
        setTimeout(() => resolve({ kind: 'timeout' }), 120);
      }),
    ]);

    expect(result.kind).toBe('ended');
    if (result.kind === 'ended') {
      expect(result.ended?.summary.mode).toBe('custom');
    }
  });

  it('allows re-recording singing attempts after an incorrect result', async () => {
    const capturedContours: number[][] = [];
    let targetMidis: number[] = [];

    const service = new SessionService(
      createMockStorage(),
      {
        async playNote() {},
        async playReferenceWithTarget() {},
        async playInterval() {},
        async playMelody() {},
        async stop() {},
      },
      {
        async capturePitchSample() { return null; },
        async capturePitchContour() {
          if (capturedContours.length === 0) {
            const wrong = targetMidis.map((midi) => midi + 7);
            capturedContours.push(wrong);
            return { detectedMidis: wrong, detectedFrequencies: wrong.map(() => 440) };
          }
          const corrected = [...targetMidis];
          capturedContours.push(corrected);
          return { detectedMidis: corrected, detectedFrequencies: corrected.map(() => 440) };
        },
        async stop() {},
      },
    );
    await service.init();

    const started = service.startCustomSession({
      skillKey: 'sing_melody',
      clef: 'treble',
      level: 2,
      count: 1,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const exercise = service.getCurrentExercise();
    expect(exercise?.skillKey).toBe('sing_melody');
    if (!exercise || exercise.skillKey !== 'sing_melody') return;

    targetMidis = Array.isArray((exercise.expectedAnswer as any).targetMidis)
      ? ((exercise.expectedAnswer as any).targetMidis as number[])
      : [];
    expect(targetMidis.length).toBeGreaterThan(0);

    const first = await service.captureSingingAttempt();
    expect(first).toBeTruthy();
    expect(first?.evaluation.correct).toBe(false);

    const second = await service.captureSingingAttempt();
    expect(second).toBeTruthy();
    expect(second?.evaluation.correct).toBe(true);

    const step = await service.nextExercise();
    expect(step.ok).toBe(true);
    if (step.ok && step.ended) {
      expect(step.summary?.total).toBe(1);
      expect(step.summary?.correct).toBe(1);
    }
  });

  it('keeps sampling sing_note windows until the user is in tune', async () => {
    let captureCount = 0;
    let targetMidi = 60;

    const service = new SessionService(
      createMockStorage(),
      {
        async playNote() {},
        async playReferenceWithTarget() {},
        async playInterval() {},
        async playMelody() {},
        async stop() {},
      },
      {
        async ensureMicrophonePermission() {},
        async capturePitchSample() {
          captureCount += 1;
          if (captureCount === 1) {
            const wrongMidi = targetMidi + 4;
            return {
              detectedFrequency: midiToFrequency(wrongMidi),
              detectedMidi: wrongMidi,
              noteName: null,
            };
          }
          return {
            detectedFrequency: midiToFrequency(targetMidi),
            detectedMidi: targetMidi,
            noteName: null,
          };
        },
        async capturePitchContour() { return null; },
        async stop() {},
      },
    );
    await service.init();

    const started = service.startCustomSession({
      skillKey: 'sing_note',
      clef: 'treble',
      level: 1,
      count: 1,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const exercise = service.getCurrentExercise();
    expect(exercise?.skillKey).toBe('sing_note');
    if (!exercise || exercise.skillKey !== 'sing_note') return;

    targetMidi = Number((exercise.expectedAnswer as { targetMidi: number }).targetMidi);
    const outcome = await service.captureSingingAttempt({
      continuousSingNote: true,
      sampleDurationMs: 700,
      maxSingNoteWindows: 5,
    });

    expect(captureCount).toBe(2);
    expect(outcome?.evaluation.correct).toBe(true);
  });
});
