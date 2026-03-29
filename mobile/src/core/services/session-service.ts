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
  ExerciseFamily,
  MelodyNote,
  MelodyOptions,
  NoteType,
  ProgressRecord,
  SessionRecord,
  SessionSummary,
  SkillKey,
} from '../types';

function createSessionId(): string {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/** Parse MelodyNote array from a sing_melody exercise prompt (backwards-compatible). */
function getMelodyNoteObjects(exercise: Exercise): MelodyNote[] {
  if (exercise.skillKey !== 'sing_melody') return [];
  const notes = (exercise.prompt as Record<string, unknown>).notes;
  if (!Array.isArray(notes)) return [];
  return (notes as unknown[]).map((n) => {
    if (n && typeof n === 'object' && 'pitch' in n && 'duration' in n) {
      return n as MelodyNote;
    }
    return { pitch: String(n), duration: 'quarter' as NoteType };
  });
}

/** Returns the number of quarter-note beats a single note occupies. */
function noteBeats(duration: NoteType): number {
  return duration === 'half' ? 2 : 1;
}

/** Returns the total number of quarter-note beats for a melody. */
function totalMelodyBeats(notes: MelodyNote[]): number {
  return notes.reduce((sum, n) => sum + noteBeats(n.duration), 0);
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
  /** When true, new exercises are appended on demand instead of ending the session. */
  isUnlimited: boolean;
  /** Generation parameters needed to create new exercises on-demand (unlimited mode). */
  unlimitedParams?: { skillKey: SkillKey; clef: Clef; level: number; melodyOptions?: MelodyOptions };
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

export type MelodyCaptureAttemptOutcome = {
  exercise: Exercise;
  evaluation: EvaluationResult;
  feedback: string;
  contour: {
    detectedMidis: number[];
    detectedFrequencies: number[];
    experimentalDetectedMidis?: number[];
    experimentalDetectedFrequencies?: number[];
  } | null;
  noteResults: MelodyNoteResult[];
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

/**
 * Build a timing model for a given BPM.
 * One quarter note = one beat = noteDurationMs.
 * @param bpm - Tempo in beats per minute.
 * @param totalBeats - Total number of quarter-note beats in the melody
 *   (half notes count as 2, quarter notes as 1).
 */
export function buildMelodyTimingModel(bpm: number, totalBeats: number): MelodyTimingModel {
  const safeBpm = Math.max(40, Math.min(200, bpm));
  const noteDurationMs = Math.round((60 / safeBpm) * 1000);
  const gapMs = Math.round(noteDurationMs * 0.15);
  const segmentMs = Math.round(noteDurationMs * 0.9);
  const captureDurationMs = totalBeats * noteDurationMs + 500;
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
    playNote: (note: string, durationMs?: number) => Promise<void>;
    playReferenceWithTarget: (reference: string, target: string) => Promise<void>;
    playInterval: (first: string, second: string) => Promise<void>;
    playMelody: (notes: string[]) => Promise<void>;
    playMelodyWithDurations?: (notes: Array<{ pitch: string; durationMs: number }>, gapMs: number) => Promise<void>;
    playMetronomeTick?: (accent?: boolean, durationMs?: number) => Promise<void>;
    stop: () => Promise<void>;
  };
  private pitchCapturePort: {
    ensureMicrophonePermission?: () => Promise<void>;
    capturePitchSample: (durationMs: number) => Promise<{
      detectedFrequency: number;
      detectedMidi: number;
      noteName: string | null;
      experimentalDetectedFrequency?: number | null;
      experimentalDetectedMidi?: number | null;
      experimentalNoteName?: string | null;
    } | null>;
    capturePitchContour: (durationMs: number, segmentMs: number) => Promise<{
      detectedMidis: number[];
      detectedFrequencies: number[];
      experimentalDetectedMidis?: number[];
      experimentalDetectedFrequencies?: number[];
    } | null>;
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
    playNote: (note: string, durationMs?: number) => Promise<void>;
    playReferenceWithTarget: (reference: string, target: string) => Promise<void>;
    playInterval: (first: string, second: string) => Promise<void>;
    playMelody: (notes: string[]) => Promise<void>;
    playMelodyWithDurations?: (notes: Array<{ pitch: string; durationMs: number }>, gapMs: number) => Promise<void>;
    playMetronomeTick?: (accent?: boolean, durationMs?: number) => Promise<void>;
    stop: () => Promise<void>;
  }, pitchCapturePort?: {
    ensureMicrophonePermission?: () => Promise<void>;
    capturePitchSample: (durationMs: number) => Promise<{
      detectedFrequency: number;
      detectedMidi: number;
      noteName: string | null;
      experimentalDetectedFrequency?: number | null;
      experimentalDetectedMidi?: number | null;
      experimentalNoteName?: string | null;
    } | null>;
    capturePitchContour: (durationMs: number, segmentMs: number) => Promise<{
      detectedMidis: number[];
      detectedFrequencies: number[];
      experimentalDetectedMidis?: number[];
      experimentalDetectedFrequencies?: number[];
    } | null>;
    setDebugListener?: (listener: ((snapshot: unknown) => void) | null) => void;
    stop: () => Promise<void>;
  }) {
    this.audioPromptPort = audioPromptPort ?? {
      async playNote() {},
      async playReferenceWithTarget() {},
      async playInterval() {},
      async playMelody() {},
      async playMetronomeTick() {},
      async stop() {},
    };
    this.pitchCapturePort = pitchCapturePort ?? {
      async ensureMicrophonePermission() {},
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
    if (!this.activeSession) return { mode: 'guided' as const, index: 0, total: 0, isUnlimited: false };
    return {
      mode: this.activeSession.mode,
      index: this.activeSession.index,
      total: this.activeSession.queue.length,
      isUnlimited: this.activeSession.isUnlimited,
    };
  }

  getCurrentExercise(): Exercise | null {
    if (!this.activeSession) return null;
    return this.activeSession.queue[this.activeSession.index] ?? null;
  }

  setPitchDebugListener(listener: ((snapshot: unknown) => void) | null): void {
    this.pitchCapturePort.setDebugListener?.(listener);
  }

  startGuidedSession(includeFamilies?: ExerciseFamily[] | null) {
    const queue = this.planner.generateGuidedSession({
      enabledClefs: this.settings.enabledClefs,
      progressBySkill: this.progressBySkill,
      exerciseCount: this.settings.dailyGoalExercises,
      generator: this.generator,
      includeFamilies: includeFamilies ?? ['visual', 'aural', 'singing'],
    }) as Exercise[];
    return this.startSession('guided', queue);
  }

  startCustomSession(input: { skillKey: SkillKey; clef: Clef; level: number; count: number; melodyOptions?: MelodyOptions }) {
    const isUnlimited = input.count === 0;
    // For unlimited mode, seed the queue with a small initial batch.
    const effectiveCount = isUnlimited ? 1 : input.count;
    const queue = this.planner.generateCustomSession({ ...input, count: effectiveCount, generator: this.generator }) as Exercise[];
    return this.startSession('custom', queue, isUnlimited, isUnlimited ? {
      skillKey: input.skillKey,
      clef: input.clef,
      level: input.level,
      melodyOptions: input.melodyOptions,
    } : undefined);
  }

  private startSession(
    mode: 'guided' | 'custom',
    queue: Exercise[],
    isUnlimited = false,
    unlimitedParams?: { skillKey: SkillKey; clef: Clef; level: number; melodyOptions?: MelodyOptions },
  ) {
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
      isUnlimited,
      unlimitedParams,
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
      const melodyNotes = getMelodyNoteObjects(exercise);
      await this.audioPromptPort.playMelody(melodyNotes.map((n) => n.pitch));
    }
  }

  async captureSingingAttempt(options: {
    bpm?: number;
    sampleDurationMs?: number;
    continuousSingNote?: boolean;
    maxSingNoteWindows?: number;
    onCountInBeat?: (beat: number) => void;
    onNoteIndex?: (index: number) => void;
    onRecordingStarted?: () => void;
  } = {}) {
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.family !== 'singing') return null;
    if (this.currentEvaluation?.correct) return null;

    if (exercise.skillKey === 'sing_melody') {
      const outcome = await this.captureMelodyExerciseAttempt(exercise, options);
      if (!outcome) return null;
      return this.applyEvaluation(exercise, outcome.evaluation, outcome.contour, null, outcome.noteResults);
    }

    await this.pitchCapturePort.ensureMicrophonePermission?.();

    if (exercise.skillKey === 'sing_note' && options.continuousSingNote) {
      const windowDurationMs = Math.max(500, options.sampleDurationMs ?? 900);
      const maxWindows = Math.max(1, options.maxSingNoteWindows ?? 45);
      const toleranceCents = this.toleranceForLevel(exercise.level);

      let lastCaptured: { detectedFrequency: number; detectedMidi: number; noteName: string | null } | null = null;
      let lastEvaluation: EvaluationResult | null = null;

      for (let i = 0; i < maxWindows; i += 1) {
        const captured = await this.pitchCapturePort.capturePitchSample(windowDurationMs);
        const evaluation = this.evaluator.evaluate(
          exercise,
          captured,
          { toleranceCents },
        );
        lastCaptured = captured;
        lastEvaluation = evaluation;

        if (evaluation.correct) {
          return this.applyEvaluation(exercise, evaluation, captured);
        }
      }

      const fallbackEvaluation = lastEvaluation ?? this.evaluator.evaluate(
        exercise,
        null,
        { toleranceCents },
      );
      return this.applyEvaluation(exercise, fallbackEvaluation, lastCaptured);
    }

    if (exercise.skillKey === 'sing_interval') {
      await this.audioPromptPort.playNote(String(exercise.prompt.reference));
    }

    const captured = await this.pitchCapturePort.capturePitchSample(
      Math.max(500, options.sampleDurationMs ?? 2200),
    );
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
    await this.playMelodyExerciseWithTiming(exercise, bpm);
  }

  createMelodyExercise(input: { clef: Clef; level: number; melodyOptions?: MelodyOptions }): Exercise {
    return this.generator.generate({
      skillKey: 'sing_melody',
      clef: input.clef,
      level: input.level,
      melodyOptions: input.melodyOptions,
    });
  }

  async playMelodyExerciseWithTiming(exercise: Exercise, bpm: number): Promise<void> {
    if (exercise.skillKey !== 'sing_melody') return;
    const melodyNoteObjects = getMelodyNoteObjects(exercise);
    if (melodyNoteObjects.length === 0) return;

    const beats = Math.max(1, totalMelodyBeats(melodyNoteObjects));
    const timing = buildMelodyTimingModel(bpm, beats);

    // Build the per-note duration list for the audio port.
    // Half notes play for 2x the quarter-note duration; quarter notes play for 1x.
    const notesWithDurations = melodyNoteObjects
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .map((noteObj) => ({
        pitch: noteObj.pitch,
        durationMs: noteBeats(noteObj.duration) * timing.noteDurationMs - timing.gapMs,
      }));

    // Use the cancellation-aware playMelodyWithDurations when available; fall back
    // to the simpler playNote loop for audio ports that don't support it (e.g. in tests).
    if (this.audioPromptPort.playMelodyWithDurations) {
      await this.audioPromptPort.playMelodyWithDurations(notesWithDurations, timing.gapMs);
    } else {
      await this.audioPromptPort.stop();
      for (let i = 0; i < notesWithDurations.length; i += 1) {
        const noteObj = notesWithDurations[i];
        if (!noteObj) continue;
        await this.audioPromptPort.playNote(noteObj.pitch, noteObj.durationMs);
        if (i < notesWithDurations.length - 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, timing.gapMs));
        }
      }
    }
  }

  async captureMelodyExerciseAttempt(
    exercise: Exercise,
    options: {
      bpm?: number;
      onCountInBeat?: (beat: number) => void;
      onNoteIndex?: (index: number) => void;
      onRecordingStarted?: () => void;
    } = {},
  ): Promise<MelodyCaptureAttemptOutcome | null> {
    if (exercise.skillKey !== 'sing_melody') return null;

    await this.pitchCapturePort.ensureMicrophonePermission?.();

    const targetMidis = Array.isArray((exercise.expectedAnswer as any).targetMidis)
      ? ((exercise.expectedAnswer as any).targetMidis as number[])
      : [];
    const melodyNoteObjects = getMelodyNoteObjects(exercise);
    const beats = Math.max(1, totalMelodyBeats(melodyNoteObjects));
    const toleranceCents = this.toleranceForLevel(exercise.level);
    const timing = buildMelodyTimingModel(options.bpm ?? DEFAULT_MELODY_BPM, beats);

    if (options.onCountInBeat) {
      const tickDurationMs = Math.min(120, Math.max(60, Math.round(timing.noteDurationMs * 0.18)));
      for (let beat = 1; beat <= COUNT_IN_BEATS; beat += 1) {
        options.onCountInBeat(beat);
        await this.audioPromptPort.playMetronomeTick?.(beat === 1, tickDurationMs);
        await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, timing.noteDurationMs - tickDurationMs)));
      }
    }

    const noteTimers: ReturnType<typeof setTimeout>[] = [];
    options.onRecordingStarted?.();
    if (options.onNoteIndex) {
      let accumulatedBeats = 0;
      for (let i = 0; i < melodyNoteObjects.length; i += 1) {
        const delay = accumulatedBeats * timing.noteDurationMs;
        noteTimers.push(setTimeout(() => options.onNoteIndex?.(i), delay));
        accumulatedBeats += noteBeats(melodyNoteObjects[i]?.duration ?? 'quarter');
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

    const normalizedDetected = Array.isArray((evaluation.accuracyDetail as any).normalizedDetected)
      ? ((evaluation.accuracyDetail as any).normalizedDetected as number[])
      : [];
    const noteResults = computeMelodyNoteResults(targetMidis, normalizedDetected, toleranceCents);

    return {
      exercise,
      evaluation,
      feedback: evaluation.feedback,
      contour,
      noteResults,
    };
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

    // Unlimited mode: append a fresh exercise when reaching the end of the queue.
    if (this.activeSession.isUnlimited && this.activeSession.index >= this.activeSession.queue.length) {
      const params = this.activeSession.unlimitedParams;
      if (params) {
        const newExercise = this.generator.generate({
          skillKey: params.skillKey,
          clef: params.clef,
          level: params.level,
          melodyOptions: params.melodyOptions,
        });
        this.activeSession.queue.push(newExercise);
      }
    }

    if (this.activeSession.index >= this.activeSession.queue.length) {
      const ended = await this.endSession();
      return { ok: true as const, ended: true as const, summary: ended?.summary ?? null };
    }

    this.currentEvaluation = null;
    return { ok: true as const, ended: false as const, exercise: this.getCurrentExercise() };
  }

  /** Discard the active session without saving any results or updating streak/progress. */
  abortSession(): void {
    if (!this.activeSession) return;
    this.activeSession = null;
    this.currentEvaluation = null;
    void this.audioPromptPort.stop().catch(() => {});
    void this.pitchCapturePort.stop().catch(() => {});
  }

  /** Returns true if the active session has no evaluated exercises yet. */
  hasNoCompletedExercises(): boolean {
    return this.activeSession !== null && this.activeSession.results.length === 0;
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
