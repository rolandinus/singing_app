import { NOTE_STRINGS } from "../config/constants.js";
import { CLEF_OPTIONS, DEFAULT_SETTINGS, MAX_LEVEL, SKILL_DEFINITIONS } from "../config/curriculum.js";
import { SingingTrainerApp } from "./singing-trainer-app.js";
import { EarTrainingPlayer } from "../audio/ear-training-player.js";
import { ProgressRepository } from "../data/progress-repository.js";
import { SettingsRepository } from "../data/settings-repository.js";
import { ExerciseEvaluator } from "../domain/exercise-evaluator.js";
import { ExerciseGenerator } from "../domain/exercise-generator.js";
import { createDefaultProgressRecord, ProgressionEngine } from "../domain/progression-engine.js";
import { SessionPlanner } from "../domain/session-planner.js";
import { autoCorrelate, midiToNoteName, noteFromPitch } from "../utils/pitch.js";
import { DashboardView } from "../ui/dashboard-view.js";
import { PracticeView } from "../ui/practice-view.js";
import { SessionSummaryView } from "../ui/session-summary-view.js";
import { SettingsView } from "../ui/settings-view.js";

const FAMILY_LABELS = {
  visual: "Visuell",
  aural: "Gehör",
  singing: "Singen",
};

function createSessionId() {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class AppShell {
  constructor(dom) {
    this.dom = dom;

    this.settingsRepository = new SettingsRepository();
    this.progressRepository = new ProgressRepository();

    this.exerciseGenerator = new ExerciseGenerator();
    this.exerciseEvaluator = new ExerciseEvaluator();
    this.progressionEngine = new ProgressionEngine();
    this.sessionPlanner = new SessionPlanner();
    this.earPlayer = new EarTrainingPlayer(window.Tone ?? null);

    this.dashboardView = new DashboardView(dom);
    this.practiceView = new PracticeView(dom);
    this.summaryView = new SessionSummaryView(dom);
    this.settingsView = new SettingsView(dom);

    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.progressBySkill = new Map();
    this.recentSessions = [];

    this.activeSession = null;
    this.currentEvaluation = null;
    this.melodyTrainer = null;

    this.audioContext = null;
    this.analyser = null;
    this.microphoneSourceNode = null;
  }

  async init() {
    await this.progressRepository.init();

    this.settings = await this.settingsRepository.load();

    const allProgress = await this.progressRepository.getAllProgress();
    allProgress.forEach((record) => {
      if (record?.skillKey) {
        this.progressBySkill.set(record.skillKey, record);
      }
    });

    this.recentSessions = await this.progressRepository.getRecentSessions(20);

    this.#populateFamilySelect();
    this.#populateLevelSelect();
    this.#refreshSkillAndClefSelectors();
    this.settingsView.render(this.settings);

    this.#bindEvents();
    this.renderDashboard();
    this.showScreen("dashboard");
    this.practiceView.renderSessionMeta({ mode: "guided", index: 0, total: 0 });
  }

  #bindEvents() {
    this.dom.navDashboardBtn.addEventListener("click", () => this.showScreen("dashboard"));
    this.dom.navPracticeBtn.addEventListener("click", () => this.showScreen("practice"));
    this.dom.navSettingsBtn.addEventListener("click", () => this.showScreen("settings"));

    this.dom.startGuidedBtn.addEventListener("click", () => {
      this.startGuidedSession();
    });

    this.dom.goCustomFromDashboardBtn.addEventListener("click", () => {
      this.showScreen("practice");
    });

    this.dom.familySelect.addEventListener("change", () => {
      this.#populateSkillSelect(this.dom.familySelect.value);
    });

    this.dom.startCustomBtn.addEventListener("click", () => {
      this.startCustomSession();
    });

    this.dom.playPromptBtn.addEventListener("click", async () => {
      await this.playPrompt();
    });

    this.dom.capturePitchBtn.addEventListener("click", async () => {
      await this.captureSingingAttempt();
    });

    this.dom.nextExerciseBtn.addEventListener("click", () => {
      this.nextExercise();
    });

    this.dom.endSessionBtn.addEventListener("click", async () => {
      await this.endSession();
    });

    this.dom.backToDashboardBtn.addEventListener("click", () => {
      this.showScreen("dashboard");
    });

    this.dom.saveSettingsBtn.addEventListener("click", async () => {
      await this.saveSettings();
    });
  }

  showScreen(screen) {
    const map = {
      dashboard: this.dom.dashboardScreen,
      practice: this.dom.practiceScreen,
      settings: this.dom.settingsScreen,
    };

    Object.values(map).forEach((element) => {
      element.classList.remove("active");
    });

    map[screen]?.classList.add("active");

    this.dom.navDashboardBtn.classList.toggle("active", screen === "dashboard");
    this.dom.navPracticeBtn.classList.toggle("active", screen === "practice");
    this.dom.navSettingsBtn.classList.toggle("active", screen === "settings");

    if (screen === "settings") {
      this.settingsView.render(this.settings);
    }
  }

  renderDashboard() {
    const skillRows = this.#buildSkillRows();

    this.dashboardView.renderSummary({
      dailyGoal: this.settings.dailyGoalExercises,
      lastSession: this.recentSessions[0] ?? null,
    });

    this.dashboardView.renderSkillMap(skillRows);
    this.dashboardView.renderRecentSessions(this.recentSessions);
  }

  #buildSkillRows() {
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

  #populateFamilySelect() {
    const families = Array.from(new Set(SKILL_DEFINITIONS.map((skill) => skill.family)));

    this.dom.familySelect.innerHTML = families
      .map((family) => `<option value="${family}">${FAMILY_LABELS[family] ?? family}</option>`)
      .join("");
  }

  #populateSkillSelect(family) {
    const skills = SKILL_DEFINITIONS.filter((skill) => skill.family === family);
    this.dom.skillSelect.innerHTML = skills
      .map((skill) => `<option value="${skill.key}">${skill.label}</option>`)
      .join("");
  }

  #populateLevelSelect() {
    this.dom.levelSelect.innerHTML = Array.from({ length: MAX_LEVEL }, (_, index) => {
      const level = index + 1;
      return `<option value="${level}">${level}</option>`;
    }).join("");
  }

  #refreshSkillAndClefSelectors() {
    const selectedFamily = this.dom.familySelect.value || "visual";
    this.#populateSkillSelect(selectedFamily);

    const clefs = this.settings.enabledClefs.length > 0 ? this.settings.enabledClefs : CLEF_OPTIONS;
    this.dom.clefSelect.innerHTML = clefs
      .map((clef) => `<option value="${clef}">${clef}</option>`)
      .join("");

    if (clefs.includes(this.settings.defaultClef)) {
      this.dom.clefSelect.value = this.settings.defaultClef;
    }
  }

  async startGuidedSession() {
    const queue = this.sessionPlanner.generateGuidedSession({
      enabledClefs: this.settings.enabledClefs,
      progressBySkill: this.progressBySkill,
      exerciseCount: this.settings.dailyGoalExercises,
      generator: this.exerciseGenerator,
    });

    this.#startSession("guided", queue);
  }

  startCustomSession() {
    const count = Number.parseInt(this.dom.countInput.value, 10) || 10;
    const skillKey = this.dom.skillSelect.value;
    const clef = this.dom.clefSelect.value;
    const level = Number.parseInt(this.dom.levelSelect.value, 10) || 1;

    const queue = this.sessionPlanner.generateCustomSession({
      skillKey,
      clef,
      level,
      count,
      generator: this.exerciseGenerator,
    });

    this.#startSession("custom", queue);
  }

  #startSession(mode, queue) {
    if (!queue.length) {
      this.practiceView.showFeedback("Keine Übungen für diese Auswahl generiert.", false);
      return;
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
    this.summaryView.hide();
    this.showScreen("practice");
    this.#renderCurrentExercise();
  }

  #getCurrentExercise() {
    if (!this.activeSession) {
      return null;
    }

    return this.activeSession.queue[this.activeSession.index] ?? null;
  }

  #renderCurrentExercise() {
    const exercise = this.#getCurrentExercise();

    if (!exercise) {
      this.endSession();
      return;
    }

    this.currentEvaluation = null;

    if (exercise.skillKey !== "sing_melody" && this.melodyTrainer) {
      this.melodyTrainer.stopAllAudioAndRecording();
    }

    this.practiceView.renderSessionMeta({
      mode: this.activeSession.mode,
      index: this.activeSession.index,
      total: this.activeSession.queue.length,
    });

    this.practiceView.renderExercise(exercise, {
      onChoice: (choice) => this.submitChoice(choice),
      onMelodyExerciseReady: () => this.prepareMelodyExercise(),
    });
  }

  prepareMelodyExercise() {
    const exercise = this.#getCurrentExercise();
    if (!exercise || exercise.skillKey !== "sing_melody") {
      return;
    }

    this.#ensureMelodyTrainer();
    this.melodyTrainer.generateAndDisplayNotes();
    this.practiceView.showFeedback("Starte mit \"Aufnahme starten\" und singe die Melodie nach.", true);
  }

  #ensureMelodyTrainer() {
    if (this.melodyTrainer) {
      return;
    }

    const requiredIds = [
      "staffSvg",
      "recordedStaffSvg",
      "messageBox",
      "detectedNoteDebug",
      "visualMetronomeToggle",
      "liveFeedbackToggle",
      "visualMetronomeIndicator",
      "bpmInput",
      "generateNotesBtn",
      "playNotesBtn",
      "recordBtn",
      "stopBtn",
      "detectedFrequency",
      "detectedNoteName",
      "continuousDetectionBtn",
      "detectionStatus",
    ];

    const melodyDom = {};
    requiredIds.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`Missing melody trainer element: #${id}`);
      }
      melodyDom[id] = element;
    });

    this.melodyTrainer = new SingingTrainerApp({
      staffSvg: melodyDom.staffSvg,
      recordedStaffSvg: melodyDom.recordedStaffSvg,
      messageBox: melodyDom.messageBox,
      detectedNoteDebug: melodyDom.detectedNoteDebug,
      visualMetronomeToggle: melodyDom.visualMetronomeToggle,
      liveFeedbackToggle: melodyDom.liveFeedbackToggle,
      visualMetronomeIndicator: melodyDom.visualMetronomeIndicator,
      bpmInput: melodyDom.bpmInput,
      generateNotesBtn: melodyDom.generateNotesBtn,
      playNotesBtn: melodyDom.playNotesBtn,
      recordBtn: melodyDom.recordBtn,
      stopBtn: melodyDom.stopBtn,
      detectedFrequency: melodyDom.detectedFrequency,
      detectedNoteName: melodyDom.detectedNoteName,
      continuousDetectionBtn: melodyDom.continuousDetectionBtn,
      detectionStatus: melodyDom.detectionStatus,
    }, {
      onMelodyEvaluated: (result) => {
        void this.handleMelodyEvaluation(result);
      },
    });

    this.melodyTrainer.init();
  }

  async handleMelodyEvaluation(result) {
    const exercise = this.#getCurrentExercise();
    if (!exercise || exercise.skillKey !== "sing_melody" || this.currentEvaluation) {
      return;
    }

    const accuracy = Number(result?.accuracy ?? 0);
    const minAccuracy = Number(exercise.expectedAnswer?.minAccuracy ?? 0.65);
    const correct = accuracy >= minAccuracy;

    await this.#applyEvaluation(exercise, {
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
    }, result);
  }

  #getToleranceForLevel(level) {
    const configured = this.settings.pitchToleranceCentsByLevel?.[level];
    return Number.isFinite(Number(configured)) ? Number(configured) : 50;
  }

  async submitChoice(choice) {
    const exercise = this.#getCurrentExercise();
    if (!exercise || exercise.family === "singing" || this.currentEvaluation) {
      return;
    }

    const evaluation = this.exerciseEvaluator.evaluate(exercise, { answer: String(choice) });
    await this.#applyEvaluation(exercise, evaluation, null, String(choice));
  }

  async playPrompt() {
    const exercise = this.#getCurrentExercise();
    if (!exercise) {
      return;
    }

    if (exercise.skillKey === "interval_aural") {
      await this.earPlayer.playInterval(exercise.prompt.first, exercise.prompt.second);
      return;
    }

    if (exercise.skillKey === "sing_note") {
      await this.earPlayer.playNote(exercise.prompt.target);
      return;
    }

    if (exercise.skillKey === "sing_interval") {
      await this.earPlayer.playReferenceWithTarget(exercise.prompt.reference, exercise.prompt.target);
    }
  }

  async captureSingingAttempt() {
    const exercise = this.#getCurrentExercise();
    if (!exercise || exercise.family !== "singing" || this.currentEvaluation) {
      return;
    }

    this.practiceView.showFeedback("Aufnahme läuft...", true);

    const captured = await this.#capturePitchSample(2200);

    const evaluation = this.exerciseEvaluator.evaluate(
      exercise,
      captured,
      { toleranceCents: this.#getToleranceForLevel(exercise.level) },
    );

    await this.#applyEvaluation(exercise, evaluation, captured);
  }

  async #applyEvaluation(exercise, evaluation, extraSubmission = null, selectedChoice = null) {
    if (!this.activeSession) {
      return;
    }

    this.currentEvaluation = evaluation;

    const timestamp = new Date().toISOString();
    const progressKey = `${exercise.clef}.${exercise.skillKey}`;
    const currentRecord = this.progressBySkill.get(progressKey) ?? createDefaultProgressRecord(progressKey);

    const { record, leveledUp } = this.progressionEngine.applyEvaluation(currentRecord, evaluation, timestamp);

    await this.progressRepository.saveProgress(record);
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
    this.practiceView.showFeedback(feedback, evaluation.correct);
    this.dom.answerOptions.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
      button.classList.add("opacity-50");
    });

    if (selectedChoice !== null && exercise.expectedAnswer?.answer != null) {
      this.practiceView.markChoiceResult(selectedChoice, exercise.expectedAnswer.answer);
    }

    const actionState = this.#getActionStateForExercise(exercise, true);
    this.practiceView.setActionVisibility(actionState);
    this.renderDashboard();
  }

  #getActionStateForExercise(exercise, nextEnabled) {
    if (exercise.skillKey === "sing_melody") {
      return {
        playPrompt: false,
        capturePitch: false,
        nextEnabled,
      };
    }

    const playPrompt = exercise.family === "aural" || exercise.family === "singing";
    const capturePitch = exercise.family === "singing";

    return {
      playPrompt,
      capturePitch,
      nextEnabled,
    };
  }

  async nextExercise() {
    if (!this.activeSession) {
      return;
    }

    const exercise = this.#getCurrentExercise();
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
      await this.endSession();
      return;
    }

    this.#renderCurrentExercise();
  }

  async endSession() {
    if (!this.activeSession) {
      return;
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

    await this.progressRepository.saveSession(sessionRecord);
    this.recentSessions = await this.progressRepository.getRecentSessions(20);

    this.summaryView.show(summary);
    this.activeSession = null;
    this.currentEvaluation = null;
    this.#stopMicrophone();
    if (this.melodyTrainer) {
      this.melodyTrainer.stopAllAudioAndRecording();
    }

    this.practiceView.renderSessionMeta({ mode: "guided", index: 0, total: 0 });
    this.renderDashboard();
  }

  async saveSettings() {
    const partial = this.settingsView.readValues();
    this.settings = await this.settingsRepository.save({
      ...this.settings,
      ...partial,
    });

    this.#refreshSkillAndClefSelectors();
    this.settingsView.render(this.settings);
    this.settingsView.showStatus("Einstellungen gespeichert.");
    this.renderDashboard();
  }

  async #ensureMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Mikrofonzugriff nicht verfügbar.");
    }

    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.minDecibels = -100;
      this.analyser.maxDecibels = -10;
      this.analyser.smoothingTimeConstant = 0.7;
      this.analyser.fftSize = 2048;
    }

    if (!this.microphoneSourceNode) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.microphoneSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.microphoneSourceNode.connect(this.analyser);
    }
  }

  #stopMicrophone() {
    if (!this.microphoneSourceNode) {
      return;
    }

    this.microphoneSourceNode.disconnect();
    this.microphoneSourceNode.mediaStream?.getTracks().forEach((track) => track.stop());
    this.microphoneSourceNode = null;
  }

  async #capturePitchSample(durationMs) {
    try {
      await this.#ensureMicrophone();
    } catch (error) {
      this.practiceView.showFeedback(`Audio-Fehler: ${error.message}`, false);
      return null;
    }

    return new Promise((resolve) => {
      const frequencies = [];
      const startedAt = performance.now();

      const intervalId = setInterval(() => {
        if (!this.analyser || !this.audioContext) {
          return;
        }

        const buffer = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(buffer);

        const frequency = autoCorrelate(buffer, this.audioContext.sampleRate);
        if (frequency !== -1 && Number.isFinite(frequency)) {
          frequencies.push(frequency);
        }

        if (performance.now() - startedAt >= durationMs) {
          clearInterval(intervalId);

          if (frequencies.length === 0) {
            this.#stopMicrophone();
            resolve(null);
            return;
          }

          const sorted = [...frequencies].sort((a, b) => a - b);
          const medianFrequency = sorted[Math.floor(sorted.length / 2)];
          const detectedMidi = noteFromPitch(medianFrequency);

          resolve({
            detectedFrequency: medianFrequency,
            detectedMidi,
            noteName: midiToNoteName(detectedMidi, NOTE_STRINGS),
          });
          this.#stopMicrophone();
        }
      }, 60);
    });
  }
}
