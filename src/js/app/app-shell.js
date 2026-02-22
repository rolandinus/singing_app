import { DEFAULT_SETTINGS, MAX_LEVEL, SKILL_DEFINITIONS } from "../config/curriculum.js";
import { SingingTrainerApp } from "./singing-trainer-app.js";
import { ExerciseEvaluator } from "../domain/exercise-evaluator.js";
import { ExerciseGenerator } from "../domain/exercise-generator.js";
import { ProgressionEngine } from "../domain/progression-engine.js";
import { SessionPlanner } from "../domain/session-planner.js";
import { BrowserAudioPromptPort } from "../adapters/browser-audio-prompt-port.js";
import { BrowserPitchCapturePort } from "../adapters/browser-pitch-capture-port.js";
import { BrowserStoragePort } from "../adapters/browser-storage-port.js";
import { DashboardView } from "../ui/dashboard-view.js";
import { PracticeView } from "../ui/practice-view.js";
import { SessionSummaryView } from "../ui/session-summary-view.js";
import { SettingsView } from "../ui/settings-view.js";
import { SessionService } from "./session-service.js";

const FAMILY_LABELS = {
  visual: "Visuell",
  aural: "Gehör",
  singing: "Singen",
};

export class AppShell {
  constructor(dom, {
    storagePort = new BrowserStoragePort(),
    audioPromptPort = new BrowserAudioPromptPort(),
    pitchCapturePort = new BrowserPitchCapturePort(),
  } = {}) {
    this.dom = dom;

    this.sessionService = new SessionService({
      storagePort,
      audioPromptPort,
      pitchCapturePort,
      exerciseGenerator: new ExerciseGenerator(),
      exerciseEvaluator: new ExerciseEvaluator(),
      progressionEngine: new ProgressionEngine(),
      sessionPlanner: new SessionPlanner(),
    });

    this.dashboardView = new DashboardView(dom);
    this.practiceView = new PracticeView(dom);
    this.summaryView = new SessionSummaryView(dom);
    this.settingsView = new SettingsView(dom);

    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.melodyTrainer = null;
  }

  async init() {
    await this.sessionService.init();

    this.settings = this.sessionService.getSettings();

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
    const skillRows = this.sessionService.buildSkillRows();
    const recentSessions = this.sessionService.getRecentSessions();

    this.dashboardView.renderSummary({
      dailyGoal: this.settings.dailyGoalExercises,
      lastSession: recentSessions[0] ?? null,
    });

    this.dashboardView.renderSkillMap(skillRows);
    this.dashboardView.renderRecentSessions(recentSessions);
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

    const clefs = this.sessionService.getClefChoices();
    this.dom.clefSelect.innerHTML = clefs
      .map((clef) => `<option value="${clef}">${clef}</option>`)
      .join("");

    if (clefs.includes(this.settings.defaultClef)) {
      this.dom.clefSelect.value = this.settings.defaultClef;
    }
  }

  startGuidedSession() {
    const started = this.sessionService.startGuidedSession();
    if (!started.ok) {
      this.practiceView.showFeedback(started.error, false);
      return;
    }

    this.summaryView.hide();
    this.showScreen("practice");
    this.#renderCurrentExercise();
  }

  startCustomSession() {
    const count = Number.parseInt(this.dom.countInput.value, 10) || 10;
    const skillKey = this.dom.skillSelect.value;
    const clef = this.dom.clefSelect.value;
    const level = Number.parseInt(this.dom.levelSelect.value, 10) || 1;

    const started = this.sessionService.startCustomSession({ skillKey, clef, level, count });
    if (!started.ok) {
      this.practiceView.showFeedback(started.error, false);
      return;
    }

    this.summaryView.hide();
    this.showScreen("practice");
    this.#renderCurrentExercise();
  }

  #renderCurrentExercise() {
    const exercise = this.sessionService.getCurrentExercise();

    if (!exercise) {
      void this.endSession();
      return;
    }

    if (exercise.skillKey !== "sing_melody" && this.melodyTrainer) {
      this.melodyTrainer.stopAllAudioAndRecording();
    }

    this.practiceView.renderSessionMeta(this.sessionService.getSessionMeta());

    this.practiceView.renderExercise(exercise, {
      onChoice: (choice) => this.submitChoice(choice),
      onMelodyExerciseReady: () => this.prepareMelodyExercise(),
    });
  }

  prepareMelodyExercise() {
    const exercise = this.sessionService.getCurrentExercise();
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
    const outcome = await this.sessionService.handleMelodyEvaluation(result);
    this.#handleEvaluationOutcome(outcome);
  }

  async submitChoice(choice) {
    const outcome = await this.sessionService.submitChoice(choice);
    this.#handleEvaluationOutcome(outcome);
  }

  async playPrompt() {
    await this.sessionService.playPrompt();
  }

  async captureSingingAttempt() {
    this.practiceView.showFeedback("Aufnahme läuft...", true);

    try {
      const outcome = await this.sessionService.captureSingingAttempt();
      this.#handleEvaluationOutcome(outcome);
    } catch (error) {
      this.practiceView.showFeedback(`Audio-Fehler: ${error.message}`, false);
    }
  }

  #handleEvaluationOutcome(outcome) {
    if (!outcome) {
      return;
    }

    const { exercise, evaluation, feedback, selectedChoice, expectedChoice } = outcome;

    this.practiceView.showFeedback(feedback, evaluation.correct);
    this.dom.answerOptions.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
      button.classList.add("opacity-50");
    });

    if (selectedChoice !== null && expectedChoice !== null) {
      this.practiceView.markChoiceResult(selectedChoice, expectedChoice);
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
    const result = await this.sessionService.nextExercise();
    if (!result?.ok) {
      return;
    }

    if (result.ended) {
      this.#applySessionEnded(result.summary);
      return;
    }

    this.#renderCurrentExercise();
  }

  #applySessionEnded(summary) {
    if (!summary) {
      return;
    }

    this.summaryView.show(summary);

    if (this.melodyTrainer) {
      this.melodyTrainer.stopAllAudioAndRecording();
    }

    this.practiceView.renderSessionMeta({ mode: "guided", index: 0, total: 0 });
    this.renderDashboard();
  }

  async endSession() {
    const ended = await this.sessionService.endSession();
    if (!ended) {
      return;
    }

    this.#applySessionEnded(ended.summary);
  }

  async saveSettings() {
    const partial = this.settingsView.readValues();
    this.settings = await this.sessionService.saveSettings(partial);

    this.#refreshSkillAndClefSelectors();
    this.settingsView.render(this.settings);
    this.settingsView.showStatus("Einstellungen gespeichert.");
    this.renderDashboard();
  }
}
