import { CLEF_OPTIONS, DEFAULT_SETTINGS, SKILL_DEFINITIONS } from '../config/curriculum';
import { ExerciseEvaluator } from '../domain/exercise-evaluator';
import { ExerciseGenerator } from '../domain/exercise-generator';
import { createDefaultProgressRecord, ProgressionEngine } from '../domain/progression-engine';
import { SessionPlanner } from '../domain/session-planner';
import type { AppSettings, Clef, EvaluationResult, Exercise, ProgressRecord, SessionRecord, SessionSummary, SkillKey } from '../types';

function createSessionId(): string {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

type ActiveSession = {
  sessionId: string;
  mode: 'guided' | 'custom';
  queue: Exercise[];
  index: number;
  results: SessionRecord['exercises'];
  startedAt: string;
};

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

  constructor(private storage: {
    init: () => Promise<void>;
    loadSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings>;
    getAllProgress: () => Promise<ProgressRecord[]>;
    saveProgress: (record: ProgressRecord) => Promise<ProgressRecord>;
    saveSession: (session: SessionRecord) => Promise<SessionRecord>;
    getRecentSessions: (limit?: number) => Promise<SessionRecord[]>;
  }) {}

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
      SKILL_DEFINITIONS.filter((s) => s.family === 'visual').forEach((skill) => {
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

  startGuidedSession() {
    const queue = this.planner.generateGuidedSession({
      enabledClefs: this.settings.enabledClefs,
      progressBySkill: this.progressBySkill,
      exerciseCount: this.settings.dailyGoalExercises,
      generator: this.generator,
      visualOnly: true,
    }) as Exercise[];
    return this.startSession('guided', queue);
  }

  startCustomSession(input: { skillKey: SkillKey; clef: Clef; level: number; count: number }) {
    const queue = this.planner.generateCustomSession({ ...input, generator: this.generator }) as Exercise[];
    return this.startSession('custom', queue);
  }

  private startSession(mode: 'guided' | 'custom', queue: Exercise[]) {
    if (!queue.length) return { ok: false as const, error: 'Keine Übungen für diese Auswahl generiert.' };

    this.activeSession = {
      sessionId: createSessionId(),
      mode,
      queue,
      index: 0,
      results: [],
      startedAt: new Date().toISOString(),
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

  async nextExercise() {
    if (!this.activeSession) return { ok: false as const };

    const exercise = this.getCurrentExercise();
    if (exercise && !this.currentEvaluation) {
      const evaluation = this.evaluator.evaluate(exercise, { answer: '__skip__' });
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
    if (!this.activeSession) return null;

    const total = this.activeSession.results.length;
    const correct = this.activeSession.results.filter((r) => r.correct).length;
    const accuracy = total > 0 ? correct / total : 0;

    const summary: SessionSummary = { mode: this.activeSession.mode, total, correct, accuracy };
    const completedAt = new Date().toISOString();

    const sessionRecord: SessionRecord = {
      sessionId: this.activeSession.sessionId,
      startedAt: this.activeSession.startedAt,
      completedAt,
      mode: this.activeSession.mode,
      exercises: this.activeSession.results,
      summary,
    };

    await this.storage.saveSession(sessionRecord);
    this.recentSessions = await this.storage.getRecentSessions(20);

    this.activeSession = null;
    this.currentEvaluation = null;

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

  private async applyEvaluation(exercise: Exercise, evaluation: EvaluationResult, extraSubmission: unknown = null, selectedChoice: string | null = null) {
    if (!this.activeSession) return null;

    this.currentEvaluation = evaluation;

    const timestamp = new Date().toISOString();
    const progressKey = `${exercise.clef}.${exercise.skillKey}`;
    const currentRecord = this.progressBySkill.get(progressKey) ?? createDefaultProgressRecord(progressKey);
    const { record, leveledUp } = this.progression.applyEvaluation(currentRecord, evaluation, timestamp);

    await this.storage.saveProgress(record);
    this.progressBySkill.set(progressKey, record);

    this.activeSession.results.push({
      exerciseId: exercise.id,
      skillKey: exercise.skillKey,
      clef: exercise.clef,
      correct: evaluation.correct,
      score: evaluation.score,
      submission: extraSubmission,
      evaluatedAt: timestamp,
    });

    const baseFeedback = evaluation.feedback || (evaluation.correct ? 'Richtig' : 'Falsch');
    const feedback = leveledUp ? `${baseFeedback} • Level Up auf L${record.level}` : baseFeedback;

    return {
      exercise,
      evaluation,
      feedback,
      selectedChoice,
      expectedChoice: (exercise.expectedAnswer as any)?.answer != null ? String((exercise.expectedAnswer as any).answer) : null,
    };
  }
}
