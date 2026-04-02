import { CLEF_OPTIONS, DEFAULT_SETTINGS, SKILL_DEFINITIONS } from "../config/curriculum.js";
import { createDefaultProgressRecord } from "../domain/progression-engine.js";

function createSessionId() {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class SessionService {
  constructor({
    storagePort,
    audioPromptPort,
    pitchCapturePort,
    exerciseGenerator,
    exerciseEvaluator,
    progressionEngine,
    sessionPlanner,
  }) {
    this.storagePort = storagePort;
    this.audioPromptPort = audioPromptPort;
    this.pitchCapturePort = pitchCapturePort;
    this.exerciseGenerator = exerciseGenerator;
    this.exerciseEvaluator = exerciseEvaluator;
    this.progressionEngine = progressionEngine;
    this.sessionPlanner = sessionPlanner;

    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.progressBySkill = new Map();
    this.recentSessions = [];

    this.activeSession = null;
    this.currentEvaluation = null;
  }

  async init() {
    await this.storagePort.init();

    this.settings = await this.storagePort.loadSettings();

    const allProgress = await this.storagePort.getAllProgress();
    allProgress.forEach((record) => {
      if (record?.skillKey) {
        this.progressBySkill.set(record.skillKey, record);
      }
    });

    this.recentSessions = await this.storagePort.getRecentSessions(20);
  }

  getSettings() {
    return this.settings;
  }

  getRecentSessions() {
    return this.recentSessions;
  }

  getProgressBySkill() {
    return this.progressBySkill;
  }

  getCurrentExercise() {
    if (!this.activeSession) {
      return null;
    }

    return this.activeSession.queue[this.activeSession.index] ?? null;
  }

  getSessionMeta() {
    if (!this.activeSession) {
      return { mode: "guided", index: 0, total: 0 };
    }

    return {
      mode: this.activeSession.mode,
      index: this.activeSession.index,
      total: this.activeSession.queue.length,
    };
  }

  buildSkillRows() {
    const rows = [];

    this.settings.enabledClefs.forEach((clef) => {
      SKILL_DEFINITIONS.forEach((skill) => {
        const progressKey = `${clef}.${skill.key}`;
        const record = this.progressBySkill.get(progressKey) ?? createDefaultProgressRecord(progressKey);

        rows.push({
          clef,
          skillKey: skill.key,
          level: record.level,
          mastery: record.mastery,
          attemptsTotal: record.attemptsTotal,
        });
      });
    });

    return rows;
  }

  getClefChoices() {
    const clefs = this.settings.enabledClefs.length > 0 ? this.settings.enabledClefs : CLEF_OPTIONS;
    return [...clefs];
  }

  startGuidedSession() {
    const queue = this.sessionPlanner.generateGuidedSession({
      enabledClefs: this.settings.enabledClefs,
      progressBySkill: this.progressBySkill,
      exerciseCount: this.settings.dailyGoalExercises,
      generator: this.exerciseGenerator,
    });

    return this.#startSession("guided", queue);
  }

  startCustomSession({ skillKey, clef, level, count }) {
    const queue = this.sessionPlanner.generateCustomSession({
      skillKey,
      clef,
      level,
      count,
      generator: this.exerciseGenerator,
    });

    return this.#startSession("custom", queue);
  }

  #startSession(mode, queue) {
    if (!queue.length) {
      return { ok: false, error: "Keine Übungen für diese Auswahl generiert." };
    }

    this.activeSession = {
      sessionId: createSessionId(),
      mode,
      queue,
      index: 0,
      results: [],
      startedAt: new Date().toISOString(),
    };

    this.currentEvaluation = null;
    return { ok: true, exercise: this.getCurrentExercise() };
  }

  async playPrompt() {
    const exercise = this.getCurrentExercise();
    if (!exercise) {
      return;
    }

    if (exercise.skillKey === "interval_aural") {
      await this.audioPromptPort.playInterval(exercise.prompt.first, exercise.prompt.second);
      return;
    }

    if (exercise.skillKey === "sing_note") {
      await this.audioPromptPort.playNote(exercise.prompt.target);
      return;
    }

    if (exercise.skillKey === "sing_interval") {
      await this.audioPromptPort.playReferenceWithTarget(exercise.prompt.reference, exercise.prompt.target);
    }
  }

  async submitChoice(choice) {
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.family === "singing" || this.currentEvaluation) {
      return null;
    }

    const evaluation = this.exerciseEvaluator.evaluate(exercise, { answer: String(choice) });
    return this.#applyEvaluation(exercise, evaluation, null, String(choice));
  }

  async captureSingingAttempt() {
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.family !== "singing" || this.currentEvaluation) {
      return null;
    }

    const captured = await this.pitchCapturePort.capturePitchSample(2200);

    const evaluation = this.exerciseEvaluator.evaluate(
      exercise,
      captured,
      { toleranceCents: this.#getToleranceForLevel(exercise.level) },
    );

    return this.#applyEvaluation(exercise, evaluation, captured);
  }

  async handleMelodyEvaluation(result) {
    const exercise = this.getCurrentExercise();
    if (!exercise || exercise.skillKey !== "sing_melody" || this.currentEvaluation) {
      return null;
    }

    const accuracy = Number(result?.accuracy ?? 0);
    const minAccuracy = Number(exercise.expectedAnswer?.minAccuracy ?? 0.65);
    const correct = accuracy >= minAccuracy;

    return this.#applyEvaluation(
      exercise,
      {
        correct,
        score: Math.max(0, Math.min(1, accuracy)),
        accuracyDetail: {
          totalNotes: result?.totalNotes ?? 0,
          correctNotes: result?.correctNotes ?? 0,
          accuracy,
          minAccuracy,
        },
        feedback: `Melodie: ${result?.correctNotes ?? 0}/${result?.totalNotes ?? 0} korrekt (${Math.round(accuracy * 100)}%)`,
        telemetry: {},
      },
      result,
    );
  }

  async #applyEvaluation(exercise, evaluation, extraSubmission = null, selectedChoice = null) {
    if (!this.activeSession) {
      return null;
    }

    this.currentEvaluation = evaluation;

    const timestamp = new Date().toISOString();
    const progressKey = `${exercise.clef}.${exercise.skillKey}`;
    const currentRecord = this.progressBySkill.get(progressKey) ?? createDefaultProgressRecord(progressKey);

    const { record, leveledUp } = this.progressionEngine.applyEvaluation(currentRecord, evaluation, timestamp);

    await this.storagePort.saveProgress(record);
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

    const baseFeedback = evaluation.feedback || (evaluation.correct ? "Richtig" : "Falsch");
    const feedback = leveledUp ? `${baseFeedback} • Level Up auf L${record.level}` : baseFeedback;

    return {
      exercise,
      evaluation,
      feedback,
      record,
      selectedChoice,
      expectedChoice: exercise.expectedAnswer?.answer != null ? String(exercise.expectedAnswer.answer) : null,
    };
  }

  async nextExercise() {
    if (!this.activeSession) {
      return { ok: false };
    }

    const exercise = this.getCurrentExercise();
    if (exercise && !this.currentEvaluation) {
      if (exercise.skillKey === "sing_melody") {
        await this.#applyEvaluation(exercise, {
          correct: false,
          score: 0,
          accuracyDetail: { skipped: true },
          feedback: "Melodie-Übung übersprungen",
          telemetry: {},
        });
      } else {
        const evaluation = this.exerciseEvaluator.evaluate(
          exercise,
          exercise.family === "singing" ? null : { answer: "__skip__" },
          { toleranceCents: this.#getToleranceForLevel(exercise.level) },
        );
        await this.#applyEvaluation(exercise, evaluation);
      }
    }

    this.activeSession.index += 1;

    if (this.activeSession.index >= this.activeSession.queue.length) {
      const ended = await this.endSession();
      return { ok: true, ended: true, summary: ended?.summary ?? null };
    }

    this.currentEvaluation = null;
    return { ok: true, ended: false, exercise: this.getCurrentExercise() };
  }

  async endSession() {
    if (!this.activeSession) {
      return null;
    }

    const total = this.activeSession.results.length;
    const correct = this.activeSession.results.filter((result) => result.correct).length;
    const accuracy = total > 0 ? correct / total : 0;

    const summary = {
      mode: this.activeSession.mode,
      total,
      correct,
      accuracy,
    };

    const completedAt = new Date().toISOString();

    const sessionRecord = {
      sessionId: this.activeSession.sessionId,
      startedAt: this.activeSession.startedAt,
      completedAt,
      mode: this.activeSession.mode,
      exercises: this.activeSession.results,
      summary,
    };

    await this.storagePort.saveSession(sessionRecord);
    this.recentSessions = await this.storagePort.getRecentSessions(20);

    this.activeSession = null;
    this.currentEvaluation = null;
    this.pitchCapturePort.stop();

    return { summary, sessionRecord };
  }

  async saveSettings(partial) {
    this.settings = await this.storagePort.saveSettings({
      ...this.settings,
      ...partial,
    });

    return this.settings;
  }

  #getToleranceForLevel(level) {
    const configured = this.settings.pitchToleranceCentsByLevel?.[level];
    return Number.isFinite(Number(configured)) ? Number(configured) : 50;
  }
}
