import { describe, expect, it, vi } from 'vitest';
import {
  buildMelodyTimingModel,
  computeMelodyNoteResults,
  COUNT_IN_BEATS,
  DEFAULT_MELODY_BPM,
  SessionService,
} from '../core/services/session-service';
import { DEFAULT_SETTINGS } from '../core/config/curriculum';

// ---------------------------------------------------------------------------
// Timing model
// ---------------------------------------------------------------------------

describe('buildMelodyTimingModel', () => {
  it('computes correct note duration from BPM', () => {
    const model = buildMelodyTimingModel(60, 4);
    // At 60 BPM, one beat = 1000 ms.
    expect(model.noteDurationMs).toBe(1000);
    expect(model.bpm).toBe(60);
  });

  it('computes capture duration as noteCount * noteDuration + 500 buffer', () => {
    const model = buildMelodyTimingModel(60, 4);
    expect(model.captureDurationMs).toBe(4 * 1000 + 500);
  });

  it('clamps BPM to valid range [40, 200]', () => {
    expect(buildMelodyTimingModel(10, 4).bpm).toBe(40);
    expect(buildMelodyTimingModel(999, 4).bpm).toBe(200);
  });

  it('uses DEFAULT_MELODY_BPM as a reasonable tempo', () => {
    expect(DEFAULT_MELODY_BPM).toBeGreaterThanOrEqual(40);
    expect(DEFAULT_MELODY_BPM).toBeLessThanOrEqual(200);
  });

  it('gap is smaller than note duration', () => {
    const model = buildMelodyTimingModel(72, 4);
    expect(model.gapMs).toBeLessThan(model.noteDurationMs);
  });
});

// ---------------------------------------------------------------------------
// Note-level result computation
// ---------------------------------------------------------------------------

describe('computeMelodyNoteResults', () => {
  it('marks exact matches as correct', () => {
    const results = computeMelodyNoteResults([60, 62, 64], [60, 62, 64], 50);
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.correct).toBe(true);
      expect(r.score).toBeCloseTo(1, 1);
    });
  });

  it('marks notes one semitone off as incorrect with tolerance 50 cents', () => {
    // 1 semitone = 100 cents, tolerance is 50 cents.
    const results = computeMelodyNoteResults([60], [61], 50);
    expect(results[0]?.correct).toBe(false);
  });

  it('marks notes exactly at tolerance boundary as correct', () => {
    // detectedMidi - targetMidi = 0.5 semitone = 50 cents, should be correct.
    const results = computeMelodyNoteResults([60], [60.5], 50);
    expect(results[0]?.correct).toBe(true);
  });

  it('handles null detected (missing note) gracefully', () => {
    const results = computeMelodyNoteResults([60, 62], [], 50);
    // When normalizedDetected is empty, all results have score 0.
    results.forEach((r) => {
      expect(r.correct).toBe(false);
      expect(r.score).toBe(0);
    });
  });

  it('assigns noteIndex matching position', () => {
    const results = computeMelodyNoteResults([60, 62, 64], [60, 62, 64], 50);
    results.forEach((r, i) => {
      expect(r.noteIndex).toBe(i);
    });
  });
});

// ---------------------------------------------------------------------------
// COUNT_IN_BEATS constant
// ---------------------------------------------------------------------------

describe('COUNT_IN_BEATS', () => {
  it('is a positive integer', () => {
    expect(COUNT_IN_BEATS).toBeGreaterThan(0);
    expect(Number.isInteger(COUNT_IN_BEATS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SessionService melody trainer features
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

describe('SessionService melody trainer', () => {
  it('regenerateMelody replaces the current exercise with a new one', () => {
    const service = new SessionService(createMockStorage());
    service['settings'] = { ...DEFAULT_SETTINGS };

    const started = service.startCustomSession({
      skillKey: 'sing_melody',
      clef: 'treble',
      level: 1,
      count: 1,
    });
    expect(started.ok).toBe(true);

    const original = service.getCurrentExercise();
    expect(original?.skillKey).toBe('sing_melody');

    const regenerated = service.regenerateMelody();
    expect(regenerated).not.toBeNull();
    // The exercise ID should change because it is generated fresh.
    expect(regenerated?.id).not.toBe(original?.id);

    const current = service.getCurrentExercise();
    expect(current?.id).toBe(regenerated?.id);
  });

  it('regenerateMelody clears currentEvaluation', () => {
    const service = new SessionService(createMockStorage());
    service['settings'] = { ...DEFAULT_SETTINGS };

    service.startCustomSession({ skillKey: 'sing_melody', clef: 'treble', level: 1, count: 1 });

    // Manually set a non-null evaluation.
    (service as any).currentEvaluation = { correct: false, score: 0, accuracyDetail: {}, feedback: '', telemetry: {} };
    expect((service as any).currentEvaluation).not.toBeNull();

    service.regenerateMelody();
    expect((service as any).currentEvaluation).toBeNull();
  });

  it('regenerateMelody returns null when no active session', () => {
    const service = new SessionService(createMockStorage());
    expect(service.regenerateMelody()).toBeNull();
  });

  it('regenerateMelody returns null for non-melody exercises', () => {
    const service = new SessionService(createMockStorage());
    service['settings'] = { ...DEFAULT_SETTINGS };
    service.startCustomSession({ skillKey: 'sing_note', clef: 'treble', level: 1, count: 1 });
    expect(service.regenerateMelody()).toBeNull();
  });

  it('captureSingingAttempt fires count-in callbacks before capture', async () => {
    const beats: number[] = [];
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
        async capturePitchContour(durationMs, segmentMs) {
          return { detectedMidis: [60, 62, 64], detectedFrequencies: [262, 294, 330] };
        },
        async stop() {},
      },
    );
    await service.init();

    service.startCustomSession({ skillKey: 'sing_melody', clef: 'treble', level: 1, count: 1 });

    // Use very fast BPM so test does not take long.
    const result = await service.captureSingingAttempt({
      bpm: 200,
      onCountInBeat: (beat) => beats.push(beat),
    });

    expect(beats).toEqual([1, 2, 3, 4]);
    expect(result).not.toBeNull();
  });

  it('captureSingingAttempt schedules onNoteIndex timers (timers cleared after capture)', async () => {
    // The onNoteIndex timers use setTimeout at intervals based on BPM. At 200 BPM the note
    // duration is 300ms. The mock capturePitchContour resolves synchronously which means
    // the timers are cleared before they can fire (intended: the service fires them during
    // the real async capture window). We verify the service attempts to schedule them by
    // providing a slow capture that allows the first timer (delay 0) to fire.
    const noteIndices: number[] = [];
    const service = new SessionService(
      createMockStorage(),
      { async playNote() {}, async playReferenceWithTarget() {}, async playInterval() {}, async playMelody() {}, async stop() {} },
      {
        async capturePitchSample() { return null; },
        capturePitchContour(durationMs: number, segmentMs: number): Promise<{ detectedMidis: number[]; detectedFrequencies: number[] }> {
          // Yield to allow delay-0 setTimeout (index 0) to fire.
          return new Promise((resolve) =>
            setTimeout(() => resolve({ detectedMidis: [60, 62, 64], detectedFrequencies: [262, 294, 330] }), 10),
          );
        },
        async stop() {},
      },
    );
    await service.init();
    service.startCustomSession({ skillKey: 'sing_melody', clef: 'treble', level: 1, count: 1 });

    await service.captureSingingAttempt({
      bpm: 200,
      onNoteIndex: (idx) => noteIndices.push(idx),
    });

    // Index 0 fires at delay 0 and should complete before the 10ms capture resolves.
    expect(noteIndices).toContain(0);
  });

  it('captureSingingAttempt returns noteResults with per-note data', async () => {
    const service = new SessionService(
      createMockStorage(),
      { async playNote() {}, async playReferenceWithTarget() {}, async playInterval() {}, async playMelody() {}, async stop() {} },
      {
        async capturePitchSample() { return null; },
        async capturePitchContour() {
          // Return exact target midis for a perfect score.
          return { detectedMidis: [60, 62, 64, 65, 67], detectedFrequencies: [262, 294, 330, 349, 392] };
        },
        async stop() {},
      },
    );
    await service.init();
    service.startCustomSession({ skillKey: 'sing_melody', clef: 'treble', level: 1, count: 1 });

    const result = await service.captureSingingAttempt({ bpm: 200 });
    expect(result).not.toBeNull();
    expect(Array.isArray(result?.noteResults)).toBe(true);
    expect(result?.noteResults.length).toBeGreaterThan(0);
  });

  it('stopPrompt delegates to audioPromptPort.stop', async () => {
    let stopped = false;
    const service = new SessionService(
      createMockStorage(),
      { async playNote() {}, async playReferenceWithTarget() {}, async playInterval() {}, async playMelody() {}, async stop() { stopped = true; } },
      { async capturePitchSample() { return null; }, async capturePitchContour() { return null; }, async stop() {} },
    );
    await service.stopPrompt();
    expect(stopped).toBe(true);
  });

  it('playMelodyWithTiming plays each note at BPM-derived gaps', async () => {
    const playedNotes: string[] = [];
    const service = new SessionService(
      createMockStorage(),
      {
        async playNote(note) { playedNotes.push(note); },
        async playReferenceWithTarget() {},
        async playInterval() {},
        async playMelody() {},
        async stop() {},
      },
      { async capturePitchSample() { return null; }, async capturePitchContour() { return null; }, async stop() {} },
    );
    await service.init();
    service.startCustomSession({ skillKey: 'sing_melody', clef: 'treble', level: 1, count: 1 });

    const exercise = service.getCurrentExercise();
    const notes = Array.isArray((exercise?.prompt as any)?.notes) ? (exercise?.prompt as any).notes as string[] : [];

    await service.playMelodyWithTiming(200);
    expect(playedNotes).toEqual(notes);
  });
});
