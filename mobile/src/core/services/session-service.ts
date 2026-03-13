import { CLEF_OPTIONS, DEFAULT_SETTINGS, SKILL_DEFINITIONS } from '../config/curriculum';
import { ExerciseEvaluator } from '../domain/exercise-evaluator';
import { ExerciseGenerator } from '../domain/exercise-generator';
import { createDefaultProgressRecord, ProgressionEngine } from '../domain/progression-engine';
import { SessionPlanner } from '../domain/session-planner';
import type {
  AppSettings,
  Clef,
  EvaluationResult,
  Exercise,
  MelodyOptions,
  ProgressRecord,
  SessionRecord,
  SessionSummary,
  SkillKey,
} from '../types';

function createSessionId(): string {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function logServiceDebug(stage: string, details: Record<string, unknown> = {}) {
  console.log(`[service:end-session] ${stage}`, details);
}

type ActiveSession = {
  sessionId: string;
  mode: 'guided' | 'custom';
  queue: Exercise[];
  index: number;
  results: SessionRecord['exercises'];
  startedAt: string;
  startProgressBySkill: Record<string, { mastery: number; level: number }>;
};

/** Timing parameters derived from BPM for melody playback and capture. */
export type MelodyTimingModel = {
  bpm: number;
  noteDurationMs: number;
  gapMs: number;
  segmentMs: number;
  captureDurationMs: number;
};

/** Per-note correctness result after a melody attempt. */
export type MelodyNoteResult = {
  noteIndex: number;
  targetMidi: number;
  detectedMidi: number | null;
  correct: boolean;
  score: number;
};

export const DEFAULT_MELODY_BPM = 72;
export const COUNT_IN_BEATS = 4;

/** Compute note-by-note results from evaluation detail. */
export function computeMelodyNoteResults(
  targetMidis: number[],
  normalizedDetected: number[],
  toleranceCents: number,
): MelodyNoteResult[] {
  return targetMidis.map((targetMidi, i) => {
    const detectedMidi = normalizedDetected[i] ?? null;
    if (detectedMidi === null || !Number.isFinite(detectedMidi)) {
      return { noteIndex: i, targetMidi, detectedMidi: null, correct: false, score: 0 };
    }
    const centsOff = Math.abs((detectedMidi - targetMidi) * 100);
    const score = Math.max(0, Math.min(1, 1 - centsOff / (toleranceCents * 2)));
    return { noteIndex: i, targetMidi, detectedMidi, correct: centsOff <= toleranceCents, score };
  });
}

/** Build a timing model for a given BPM (quarter-note = one melody note). */
export function buildMelodyTimingModel(bpm: number, noteCount: number): MelodyTimingModel {
  const safeBpm = Math.max(40, Math.min(200, bpm));
  const noteDurationMs = Math.round((60 / safeBpm) * 1000);
  const gapMs = Math.round(noteDurationMs * 0.15);
  const segmentMs = Math.round(noteDurationMs * 0.9);
  const captureDurationMs = noteCount * noteDurationMs + 500;
  return { bpm: safeBpm, noteDurationMs, gapMs, segmentMs, captureDurationMs };
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeSessionStreakDays(sessions: SessionRecord[]): number {
  const completedDays = new Set(
    sessions.map((session) => toLocalDateKey(new Date(session.completedAt))),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (completedDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export class SessionService {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private progressBySkill = new Map<string, ProgressRecord>();
  private recentSessions: SessionRecord[] = [];
  private activeSession: ActiveSession | null = null;
  private currentEvaluation: EvaluationResult | null = null;

  private generator = new ExerciseGenerator();
  private evaluator = new ExerciseEvaluator();
  private progression = new ProgressionEngine();
  private planner = new SessionPlanner();

  private audioPromptPort: {
    playNote: (note: string) => Promise<void>;
    playReferenceWithTarget: (reference: string, target: string) => Promise<void>;
    playInterval: (first: string, second: string) => Promise<void>;
    playMelody: (notes: string[]) => Promise<void>;
    stop: () => Promise<void>;
  };
  private pitchCapturePort: {
    capturePitchSample: (durationMs: number) => Promise<{ detectedFrequency: number; detectedMidi: number; noteName: string | null } | null>;
    capturePitchContour: (durationMs: number, segmentMs: number) => Promise<{ detectedMidis: number[]; detectedFrequencies: number[] } | null>;
    setDebugListener?: (listener: ((snapshot: unknown) => void) | null) => void;
    stop: () => Promise<void>;
  };

  constructor(private storage: {
    init: () => Promise<void>;
    loadSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings>;
    getAllProgress: () => Promise<ProgressRecord[]>;
    saveProgress: (record: ProgressRecord) => Promise<ProgressRecord>;
    saveSession: (session: SessionRecord) => Promise<SessionRecord>;
    getRecentSessions: (limit?: number) => Promise<SessionRecord[]>;
  }, audioPromptPort?: {
    playNote: (note: string) => Promise<void>;
    playReferenceWithTarget: (reference: string, target: string) => Promise<void>;
    playInterval: (first: string, second: string) => Promise<void>;
    playMelody: (notes: string[]) => Promise<void>;
    stop: () => Promise<void>;
  }, pitchCapturePort?: {
    capturePitchSample: (durationMs: number) => Promise<{ detectedFrequency: number; detectedMidi: number; noteName: string | null } | null>;
    capturePitchContour: (durationMs: number, segmentMs: number) => Promise<{ detectedMidis: number[]; detectedFrequencies: number[] } | null>;
    setDebugListener?: (listener: ((snapshot: unknown) => void) | null) => void;
    stop: () => Promise<void>;
  }) {
    this.audioPromptPort = audioPromptPort ?? {
      async playNote() {},
      async playReferenceWithTarget() {},
      async playInterval() {},
      async playMelody() {},
      async stop() {},
    };
    this.pitchCapturePort = pitchCapturePort ?? {
      async capturePitchSample() { return null; },
      async capturePitchContour() { return null; },
      async stop() {},
    };
  }

  async init(): Promise<void> {
    await this.storage.init();
    this.settings = await this.storage.loadSettings();

    const allProgress = await this.storage.getAllProgress();
    allProgress.forEach((record) => {
      if (record?.skillKey) this.progressBySkill.set(record.skillKey, record);
    });

    this.recentSessions = await this.storage.getRecentSessions(20);
  }

  getSettings(): AppSettings { return this.settings; }
  getRecentSessions(): SessionRecord[] { return this.recentSessions; }

  getClefChoices(): Clef[] {
    const clefs = this.settings.enabledClefs.length > 0 ? this.settings.enabledClefs : CLEF_OPTIONS;
    return [...clefs];
  }

  buildSkillRows() {
    const rows: Array<{ clef: Clef; skillKey: SkillKey; level: number; mastery: number; attemptsTotal: number }> = [];
    this.settings.enabledClefs.forEach((clef) => {
      SKILL_DEFINITIONS.forEach((skill) => {
        const key = `${clef}.${skill.key}`;
        const record = this.progressBySkill.get(key) ?? createDefaultProgressRecord(key);
        rows.push({ clef, skillKey: skill.key, level: record.level, mastery: record.mastery, attemptsTotal: record.attemptsTotal });
      });
    });
    return rows;
  }

  getSessionMeta() {
    if (!this.activeSession) return { mode: 'guided' as const, index: 0, total: 0 };
    return { mode: this.activeSession.mode, index: this.activeSession.index, total: this.activeSession.queue.length };
  }

  getCurrentExercise(): Exercise | null {
    if (!this.activeSession) return null;
    return this.activeSession.queue[this.activeSession.index] ?? null;
  }

  setPitchDebugListener(listener: ((snapshot: unknown) => void) | null): void {
    this.pitchCapturePort.setDebugListener?.(listener);
  }

  startGuidedSession() {
    const queue = this.planner.generateGuidedSession({
      enabledClefs: this.settings.enabledClefs,
      progressBySkill: this.progressBySkill,
      exerciseCount: this.settings.dailyGoalExercises,
      generator: this.generator,
      includeFamilies: ['visual', 'aural', 'singing'],
    }) as Exercise[];
    return this.startSession('guided', queue);
  }

  startCustomSession(input: { skillKey: SkillKey; clef: Clef; level: number; count: number; melodyOptions?: MelodyOptions }) {
    const queue = this.planner.generateCustomSession({ ...input, generator: this.generator }) as Exercise[];
    return this.startSession('custom', queue);
  }

  private startSession(mode: 'guided' | 'custom', queue: Exercise[]) {
    if (!queue.length) return { ok: false as const, error: 'Keine Übungen für diese Auswahl generiert.' };

    const startProgressBySkill: Record<string, { mastery: number; level: number }> = {};
    queue.forEach((exercise) => {
      const key = `${exercise.clef}.${exercise.skillKey}`;
      if (startProgressBySkill[key]) return;
      const record = this.progressBySkill.get(key) ?? createDefaultProgressRecord(key);
      startProgressBySkill[key] = { mastery: record.mastery, level: record.level };
    });

    this.activeSession = {
      sessionId: createSessionId(),
      mode,
      queue,
      index: 0,
      results: [],
      startedAt: new Date().toISOString(),
      startProgressBySkill,
    };
    this.currentEvaluation = null;

    return { ok: true as const, exercise: this.getCurrentExercise() };
  }

  async submitChoice(choice: string) {
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.family === 'singing' || this.currentEvaluation) return null;

    const evaluation = this.evaluator.evaluate(exercise, { answer: String(choice) });
    return this.applyEvaluation(exercise, evaluation, null, String(choice));
  }

  async playPrompt() {
    const exercise = this.getCurrentExercise();
    if (!exercise) return;

    if (exercise.skillKey === 'interval_aural') {
      await this.audioPromptPort.playInterval(String(exercise.prompt.first), String(exercise.prompt.second));
      return;
    }

    if (exercise.skillKey === 'sing_note') {
      await this.audioPromptPort.playNote(String(exercise.prompt.target));
      return;
    }

    if (exercise.skillKey === 'sing_interval') {
      await this.audioPromptPort.playInterval(String(exercise.prompt.reference), String(exercise.prompt.target));
      return;
    }

    if (exercise.skillKey === 'sing_melody') {
      const notes = Array.isArray((exercise.prompt as any).notes) ? ((exercise.prompt as any).notes as string[]) : [];
      await this.audioPromptPort.playMelody(notes.map(String));
    }
  }

  async captureSingingAttempt(options: { bpm?: number; onCountInBeat?: (beat: number) => void; onNoteIndex?: (index: number) => void } = {}) {
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.family !== 'singing') return null;
    if (this.currentEvaluation?.correct) return null;

    if (exercise.skillKey === 'sing_melody') {
      const targetMidis = Array.isArray((exercise.expectedAnswer as any).targetMidis)
        ? ((exercise.expectedAnswer as any).targetMidis as number[])
        : [];
      const noteCount = Math.max(1, targetMidis.length);
      const toleranceCents = this.toleranceForLevel(exercise.level);
      const timing = buildMelodyTimingModel(options.bpm ?? DEFAULT_MELODY_BPM, noteCount);

      // Count-in phase: fire beat callbacks before capture starts.
      if (options.onCountInBeat) {
        for (let beat = 1; beat <= COUNT_IN_BEATS; beat += 1) {
          options.onCountInBeat(beat);
          await new Promise<void>((resolve) => setTimeout(resolve, timing.noteDurationMs));
        }
      }

      // Launch note-index callbacks while capture runs concurrently.
      const noteTimers: ReturnType<typeof setTimeout>[] = [];
      if (options.onNoteIndex) {
        for (let i = 0; i < noteCount; i += 1) {
          const delay = i * timing.noteDurationMs;
          noteTimers.push(setTimeout(() => options.onNoteIndex!(i), delay));
        }
      }

      let contour: { detectedMidis: number[]; detectedFrequencies: number[] } | null = null;
      try {
        contour = await this.pitchCapturePort.capturePitchContour(timing.captureDurationMs, timing.segmentMs);
      } finally {
        noteTimers.forEach(clearTimeout);
      }

      const evaluation = this.evaluator.evaluate(
        exercise,
        contour ?? { detectedMidis: [] },
        { toleranceCents },
      );

      // Compute per-note results from evaluation detail.
      const normalizedDetected = Array.isArray((evaluation.accuracyDetail as any).normalizedDetected)
        ? ((evaluation.accuracyDetail as any).normalizedDetected as number[])
        : [];
      const noteResults = computeMelodyNoteResults(targetMidis, normalizedDetected, toleranceCents);

      return this.applyEvaluation(exercise, evaluation, contour, null, noteResults);
    }

    const captured = await this.pitchCapturePort.capturePitchSample(2200);
    const evaluation = this.evaluator.evaluate(
      exercise,
      captured,
      { toleranceCents: this.toleranceForLevel(exercise.level) },
    );

    return this.applyEvaluation(exercise, evaluation, captured);
  }

  /** Stop active prompt playback (no-op if not playing). */
  async stopPrompt(): Promise<void> {
    await this.audioPromptPort.stop();
  }

  /** Stop active pitch capture (no-op if not capturing). */
  async stopCapture(): Promise<void> {
    await this.pitchCapturePort.stop();
  }

  /** Regenerate the current sing_melody exercise with a fresh melody, keeping the same options. */
  regenerateMelody(): Exercise | null {
    if (!this.activeSession) return null;
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.skillKey !== 'sing_melody') return null;

    const options: MelodyOptions = {
      firstNoteMode: (exercise.metadata.melodyFirstNoteMode as any) ?? 'random',
      allowedIntervalSteps: Array.isArray(exercise.metadata.melodyAllowedIntervalSteps)
        ? (exercise.metadata.melodyAllowedIntervalSteps as number[])
        : [1, 2, 3],
    };
    const newExercise = this.generator.generate({
      skillKey: 'sing_melody',
      clef: exercise.clef,
      level: exercise.level,
      melodyOptions: options,
    });

    this.activeSession.queue[this.activeSession.index] = newExercise;
    this.currentEvaluation = null;
    return newExercise;
  }

  /** Play a single note for audition (e.g., tap on staff note). */
  async auditNote(note: string): Promise<void> {
    await this.audioPromptPort.playNote(note);
  }

  /** Play the melody prompt with BPM-aware note-gap timing. */
  async playMelodyWithTiming(bpm: number): Promise<void> {
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.skillKey !== 'sing_melody') return;
    const notes = Array.isArray((exercise.prompt as any).notes) ? ((exercise.prompt as any).notes as string[]) : [];
    if (notes.length === 0) return;

    await this.audioPromptPort.stop();

    const timing = buildMelodyTimingModel(bpm, notes.length);
    // Use the audio port's melody method which handles sequencing.
    // We pass a custom gap via the playMelody interface which uses fixed 140 ms gaps.
    // For BPM-aware gaps we drive notes manually via playNote + gap.
    for (let i = 0; i < notes.length; i += 1) {
      await this.audioPromptPort.playNote(String(notes[i]));
      if (i < notes.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, timing.gapMs));
      }
    }
  }

  async nextExercise() {
    if (!this.activeSession) return { ok: false as const };

    const exercise = this.getCurrentExercise();
    if (exercise && !this.currentEvaluation) {
      const evaluation = this.evaluator.evaluate(
        exercise,
        exercise.family === 'singing' ? null : { answer: '__skip__' },
        { toleranceCents: this.toleranceForLevel(exercise.level) },
      );
      await this.applyEvaluation(exercise, evaluation);
    }

    this.activeSession.index += 1;
    if (this.activeSession.index >= this.activeSession.queue.length) {
      const ended = await this.endSession();
      return { ok: true as const, ended: true as const, summary: ended?.summary ?? null };
    }

    this.currentEvaluation = null;
    return { ok: true as const, ended: false as const, exercise: this.getCurrentExercise() };
  }

  async endSession() {
    if (!this.activeSession) {
      logServiceDebug('no_active_session');
      return null;
    }

    logServiceDebug('started', {
      sessionId: this.activeSession.sessionId,
      mode: this.activeSession.mode,
      queueLength: this.activeSession.queue.length,
      resultCount: this.activeSession.results.length,
      currentIndex: this.activeSession.index,
    });

    const total = this.activeSession.results.length;
    const correct = this.activeSession.results.filter((r) => r.correct).length;
    const accuracy = total > 0 ? correct / total : 0;
    const practicedSkills = this.buildSessionSkillDeltas(this.activeSession);

    const summary: SessionSummary = { mode: this.activeSession.mode, total, correct, accuracy, practicedSkills };
    const completedAt = new Date().toISOString();

    const sessionRecord: SessionRecord = {
      sessionId: this.activeSession.sessionId,
      startedAt: this.activeSession.startedAt,
      completedAt,
      mode: this.activeSession.mode,
      exercises: this.activeSession.results,
      summary,
    };

    const streakDays = computeSessionStreakDays([sessionRecord, ...this.recentSessions]);
    summary.streakDays = streakDays;

    logServiceDebug('saving_session_record', {
      sessionId: sessionRecord.sessionId,
      total,
      correct,
      accuracy,
      streakDays,
    });
    await this.storage.saveSession(sessionRecord);
    this.recentSessions = await this.storage.getRecentSessions(20);
    logServiceDebug('session_saved', {
      recentSessionsCount: this.recentSessions.length,
    });

    this.activeSession = null;
    this.currentEvaluation = null;
    logServiceDebug('session_cleared');
    // Cleanup should not block session finalization if native audio modules stall.
    void this.audioPromptPort.stop().catch(() => {});
    void this.pitchCapturePort.stop().catch(() => {});

    logServiceDebug('completed', {
      summaryMode: summary.mode,
      total: summary.total,
      correct: summary.correct,
    });
    return { summary, sessionRecord };
  }

  async saveSettings(partial: Partial<AppSettings>) {
    this.settings = await this.storage.saveSettings({ ...this.settings, ...partial });
    return this.settings;
  }

  private toleranceForLevel(level: number): number {
    const configured = this.settings.pitchToleranceCentsByLevel?.[level];
    return Number.isFinite(Number(configured)) ? Number(configured) : 50;
  }

  private async applyEvaluation(exercise: Exercise, evaluation: EvaluationResult, extraSubmission: unknown = null, selectedChoice: string | null = null, noteResults: MelodyNoteResult[] = []) {
    if (!this.activeSession) return null;

    this.currentEvaluation = evaluation;

    const timestamp = new Date().toISOString();
    const progressKey = `${exercise.clef}.${exercise.skillKey}`;
    const currentRecord = this.progressBySkill.get(progressKey) ?? createDefaultProgressRecord(progressKey);
    const { record, leveledUp } = this.progression.applyEvaluation(currentRecord, evaluation, timestamp);

    await this.storage.saveProgress(record);
    this.progressBySkill.set(progressKey, record);

    const resultRow: SessionRecord['exercises'][number] = {
      exerciseId: exercise.id,
      skillKey: exercise.skillKey,
      clef: exercise.clef,
      correct: evaluation.correct,
      score: evaluation.score,
      submission: extraSubmission,
      evaluatedAt: timestamp,
    };
    const existingResultIdx = this.activeSession.results.findIndex((row) => row.exerciseId === exercise.id);
    if (existingResultIdx >= 0) {
      this.activeSession.results[existingResultIdx] = resultRow;
    } else {
      this.activeSession.results.push(resultRow);
    }

    const baseFeedback = evaluation.feedback || (evaluation.correct ? 'Richtig' : 'Falsch');
    const feedback = leveledUp ? `${baseFeedback} • Level Up auf L${record.level}` : baseFeedback;

    return {
      exercise,
      evaluation,
      feedback,
      selectedChoice,
      expectedChoice: (exercise.expectedAnswer as any)?.answer != null ? String((exercise.expectedAnswer as any).answer) : null,
      noteResults,
    };
  }

  private buildSessionSkillDeltas(activeSession: ActiveSession): NonNullable<SessionSummary['practicedSkills']> {
    const practicedKeys = new Set(
      activeSession.results.map((result) => `${result.clef}.${result.skillKey}`),
    );

    return Array.from(practicedKeys)
      .map((progressKey) => {
        const after = this.progressBySkill.get(progressKey) ?? createDefaultProgressRecord(progressKey);
        const before = activeSession.startProgressBySkill[progressKey] ?? { mastery: 0, level: 1 };
        const [clefPart, skillPart] = progressKey.split('.');
        if (!clefPart || !skillPart) return null;

        return {
          clef: clefPart as Clef,
          skillKey: skillPart as SkillKey,
          masteryBefore: before.mastery,
          masteryAfter: after.mastery,
          masteryDelta: after.mastery - before.mastery,
          levelBefore: before.level,
          levelAfter: after.level,
        };
      })
      .filter((row): row is NonNullable<SessionSummary['practicedSkills']>[number] => Boolean(row))
      .sort((a, b) => Math.abs(b.masteryDelta) - Math.abs(a.masteryDelta));
  }
}
