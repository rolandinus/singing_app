import { describe, expect, it, vi } from 'vitest';
import { buildMelodyTimingModel, SessionService } from '../core/services/session-service';
import { DEFAULT_SETTINGS, SKILL_DEFINITIONS } from '../core/config/curriculum';
import { midiToFrequency } from '../core/utils/pitch';

function createMockStorage(options: {
  initialSettings?: typeof DEFAULT_SETTINGS;
  initialSessions?: any[];
} = {}) {
  const progress: Record<string, any> = {};
  const sessions: any[] = [...(options.initialSessions ?? [])];
  let settings = { ...DEFAULT_SETTINGS, ...(options.initialSettings ?? {}) };

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

  it('plays the sing_interval reference note before capture', async () => {
    const playedNotes: string[] = [];
    let targetMidi = 60;

    const service = new SessionService(
      createMockStorage(),
      {
        async playNote(note) {
          playedNotes.push(note);
        },
        async playReferenceWithTarget() {},
        async playInterval() {},
        async playMelody() {},
        async stop() {},
      },
      {
        async ensureMicrophonePermission() {},
        async capturePitchSample() {
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

    targetMidi = Number((exercise.expectedAnswer as { targetMidi: number }).targetMidi);
    await service.captureSingingAttempt();

    expect(playedNotes).toContain(String(exercise.prompt.reference));
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

  it('unlimited mode (count=0) keeps generating exercises on nextExercise instead of ending', async () => {
    const service = new SessionService(createMockStorage());
    await service.init();

    const started = service.startCustomSession({
      skillKey: 'note_naming',
      clef: 'treble',
      level: 1,
      count: 0, // unlimited
    });
    expect(started.ok).toBe(true);

    const meta = service.getSessionMeta();
    expect(meta.isUnlimited).toBe(true);

    // Advance through the first exercise (skip answer).
    const step1 = await service.nextExercise();
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;
    // In unlimited mode the session should NOT end when the initial queue is exhausted.
    expect((step1 as any).ended).toBe(false);

    // A second advance should also not end the session.
    const step2 = await service.nextExercise();
    expect(step2.ok).toBe(true);
    expect((step2 as any).ended).toBe(false);

    // Manually ending should produce a valid summary.
    const ended = await service.endSession();
    expect(ended).toBeTruthy();
    expect(ended?.summary.mode).toBe('custom');
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

  it('builds dashboard skill rows for every enabled clef and skill, with persisted progress applied', async () => {
    const storage = createMockStorage({
      initialSettings: {
        ...DEFAULT_SETTINGS,
        enabledClefs: ['treble'],
      },
    });
    await storage.saveProgress({
      skillKey: 'treble.note_naming',
      mastery: 0.6,
      level: 3,
      attemptsTotal: 9,
      correctTotal: 7,
      rollingWindow: [],
      lastUpdatedAt: new Date().toISOString(),
    });

    const service = new SessionService(storage);
    await service.init();

    const rows = service.buildSkillRows();
    expect(rows).toHaveLength(SKILL_DEFINITIONS.length);

    const noteNaming = rows.find((row) => row.clef === 'treble' && row.skillKey === 'note_naming');
    expect(noteNaming).toMatchObject({
      clef: 'treble',
      skillKey: 'note_naming',
      mastery: 0.6,
      level: 3,
      attemptsTotal: 9,
    });

    const untouched = rows.find((row) => row.clef === 'treble' && row.skillKey === 'sing_melody');
    expect(untouched).toMatchObject({
      mastery: 0,
      level: 1,
      attemptsTotal: 0,
    });
  });

  it('computes streakDays from consecutive prior session days when ending a session', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-04-02T10:00:00.000Z'));

      const service = new SessionService(createMockStorage({
        initialSessions: [
          {
            sessionId: 'older-1',
            startedAt: '2026-04-01T08:00:00.000Z',
            completedAt: '2026-04-01T08:05:00.000Z',
            mode: 'guided',
            exercises: [],
            summary: { mode: 'guided', total: 0, correct: 0, accuracy: 0, practicedSkills: [] },
          },
          {
            sessionId: 'older-2',
            startedAt: '2026-03-31T08:00:00.000Z',
            completedAt: '2026-03-31T08:05:00.000Z',
            mode: 'guided',
            exercises: [],
            summary: { mode: 'guided', total: 0, correct: 0, accuracy: 0, practicedSkills: [] },
          },
          {
            sessionId: 'gap-breaker',
            startedAt: '2026-03-29T08:00:00.000Z',
            completedAt: '2026-03-29T08:05:00.000Z',
            mode: 'guided',
            exercises: [],
            summary: { mode: 'guided', total: 0, correct: 0, accuracy: 0, practicedSkills: [] },
          },
        ],
      }));
      await service.init();

      service.startCustomSession({
        skillKey: 'note_naming',
        clef: 'treble',
        level: 1,
        count: 2,
      });
      await service.submitChoice('__wrong__');

      const ended = await service.endSession();
      expect(ended?.summary.streakDays).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays melody prompts with BPM-aware per-note durations on the fallback audio path', async () => {
    vi.useFakeTimers();
    try {
      const played: Array<{ note: string; durationMs: number | undefined }> = [];
      const service = new SessionService(
        createMockStorage(),
        {
          async playNote(note, durationMs) {
            played.push({ note, durationMs });
          },
          async playReferenceWithTarget() {},
          async playInterval() {},
          async playMelody() {},
          async stop() {},
        },
        {
          async capturePitchSample() { return null; },
          async capturePitchContour() { return null; },
          async stop() {},
        },
      );

      const exercise = {
        skillKey: 'sing_melody',
        prompt: {
          notes: [
            { pitch: 'C4', duration: 'quarter' },
            { pitch: 'D4', duration: 'half' },
            { pitch: 'E4', duration: 'quarter' },
          ],
        },
      } as any;

      const playback = service.playMelodyExerciseWithTiming(exercise, 120);
      await vi.runAllTimersAsync();
      await playback;

      const timing = buildMelodyTimingModel(120, 4);
      expect(played).toEqual([
        { note: 'C4', durationMs: timing.noteDurationMs - timing.gapMs },
        { note: 'D4', durationMs: timing.noteDurationMs * 2 - timing.gapMs },
        { note: 'E4', durationMs: timing.noteDurationMs - timing.gapMs },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
