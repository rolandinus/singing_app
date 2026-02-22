import { INTERVAL_LABELS } from "../config/curriculum.js";
import { clearStaff, drawNoteSequence, drawStaff } from "../render/learning-staff.js";

function toIntervalLabel(value) {
  const asNumber = Number.parseInt(value, 10);
  return INTERVAL_LABELS[asNumber] ?? String(value);
}

export class PracticeView {
  constructor(elements) {
    this.elements = elements;
    this._currentChoiceButtons = new Map();
  }

  renderSessionMeta({ mode, index, total }) {
    if (!total) {
      this.elements.sessionMeta.textContent = "Keine aktive Session";
      this.elements.sessionProgressBar.style.width = "0%";
      return;
    }

    this.elements.sessionMeta.textContent = `${mode === "guided" ? "Geführt" : "Custom"} • Übung ${index + 1}/${total}`;
    const percent = ((index) / total) * 100;
    this.elements.sessionProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }

  resetExerciseFeedback() {
    this.elements.exerciseFeedback.textContent = "";
    this.elements.exerciseFeedback.className = "text-sm font-semibold text-slate-700";
  }

  showFeedback(text, isCorrect) {
    this.elements.exerciseFeedback.textContent = text;
    this.elements.exerciseFeedback.className = isCorrect
      ? "text-sm font-semibold text-emerald-700"
      : "text-sm font-semibold text-rose-700";
  }

  setActionVisibility({ playPrompt, capturePitch, nextEnabled }) {
    this.elements.playPromptBtn.classList.toggle("hidden", !playPrompt);
    this.elements.capturePitchBtn.classList.toggle("hidden", !capturePitch);
    this.elements.nextExerciseBtn.disabled = !nextEnabled;
    this.elements.nextExerciseBtn.classList.toggle("opacity-40", !nextEnabled);
  }

  renderExercise(exercise, handlers) {
    this.resetExerciseFeedback();

    this.elements.standardExerciseBlock.classList.remove("hidden");
    this.elements.melodyTrainerPanel.classList.add("hidden");
    this.elements.answerOptions.innerHTML = "";
    this._currentChoiceButtons.clear();
    this.elements.answerOptions.className = "flex flex-wrap gap-2";
    this.elements.exerciseSubPrompt.innerHTML = "";
    this.elements.rhythmDisplay.textContent = "";
    clearStaff(this.elements.practiceStaff);

    this.setActionVisibility({ playPrompt: false, capturePitch: false, nextEnabled: false });

    const clefLabel = exercise.clef === "bass" ? "Bass" : "Treble";

    switch (exercise.skillKey) {
      case "note_naming": {
        this.elements.exercisePrompt.textContent = `Welche Note ist das? (${clefLabel})`;
        drawNoteSequence(this.elements.practiceStaff, {
          clef: exercise.clef,
          notes: [exercise.prompt.note],
        });
        this.#renderChoices(exercise, handlers);
        break;
      }

      case "interval_visual": {
        this.elements.exercisePrompt.textContent = `Welches Intervall siehst du? (${clefLabel})`;
        this.elements.exerciseSubPrompt.textContent = "Bestimme den Abstand zwischen den beiden Noten.";
        drawNoteSequence(this.elements.practiceStaff, {
          clef: exercise.clef,
          notes: [exercise.prompt.first, exercise.prompt.second],
        });
        this.elements.answerOptions.className = "interval-answer-grid";
        this.#renderIntervalChoices(exercise, handlers);
        break;
      }

      case "rhythm_id": {
        this.elements.exercisePrompt.textContent = "Welches Rhythmusmuster ist dargestellt?";
        drawStaff(this.elements.practiceStaff, { clef: exercise.clef });
        this.elements.rhythmDisplay.textContent = exercise.prompt.display;
        this.#renderChoices(exercise, handlers, false, true);
        break;
      }

      case "interval_aural": {
        this.elements.exercisePrompt.textContent = "Höre das Intervall und identifiziere es.";
        drawStaff(this.elements.practiceStaff, { clef: exercise.clef });
        const hint = document.createElement("span");
        hint.className = "listen-hint";
        hint.textContent = `♪ Klicke auf \u201EPrompt abspielen\u201C um das Intervall zu h\u00F6ren`;
        this.elements.exerciseSubPrompt.appendChild(hint);
        this.elements.answerOptions.className = "interval-answer-grid";
        this.setActionVisibility({ playPrompt: true, capturePitch: false, nextEnabled: false });
        this.#renderIntervalChoices(exercise, handlers);
        break;
      }

      case "sing_note": {
        this.elements.exercisePrompt.textContent = `Singe diesen Ton nach (${clefLabel})`;
        this.elements.exerciseSubPrompt.textContent = "Optional: zuerst Prompt abspielen, dann aufnehmen.";
        drawNoteSequence(this.elements.practiceStaff, {
          clef: exercise.clef,
          notes: [exercise.prompt.target],
        });
        this.setActionVisibility({ playPrompt: true, capturePitch: true, nextEnabled: false });
        break;
      }

      case "sing_interval": {
        this.elements.exercisePrompt.textContent = `Singe den Zielton des Intervalls (${clefLabel})`;
        this.elements.exerciseSubPrompt.textContent = "Erster Ton ist Referenz, zweiter ist Zielton.";
        drawNoteSequence(this.elements.practiceStaff, {
          clef: exercise.clef,
          notes: [exercise.prompt.reference, exercise.prompt.target],
        });
        this.setActionVisibility({ playPrompt: true, capturePitch: true, nextEnabled: false });
        break;
      }

      case "sing_melody": {
        this.elements.exercisePrompt.textContent = "Melodien singen";
        this.elements.exerciseSubPrompt.textContent = "Nutze den Trainer unten: Generieren, Einzähler, Aufnehmen, dann weiter.";
        this.elements.standardExerciseBlock.classList.add("hidden");
        this.elements.melodyTrainerPanel.classList.remove("hidden");
        this.setActionVisibility({ playPrompt: false, capturePitch: false, nextEnabled: false });
        if (typeof handlers.onMelodyExerciseReady === "function") {
          handlers.onMelodyExerciseReady();
        }
        break;
      }

      default: {
        this.elements.exercisePrompt.textContent = "Unbekannte Übung";
        drawStaff(this.elements.practiceStaff, { clef: exercise.clef });
      }
    }
  }

  markChoiceResult(selectedChoice, correctChoice) {
    const sel = String(selectedChoice);
    const cor = String(correctChoice);

    const selectedBtn = this._currentChoiceButtons.get(sel);
    const correctBtn = this._currentChoiceButtons.get(cor);

    if (selectedBtn) {
      selectedBtn.classList.add(sel === cor ? "correct" : "wrong");
    }
    if (correctBtn && sel !== cor) {
      correctBtn.classList.add("reveal-correct");
    }
  }

  #renderIntervalChoices(exercise, handlers) {
    exercise.choices.forEach((choice) => {
      const asNumber = Number.parseInt(choice, 10);
      const label = INTERVAL_LABELS[asNumber] ?? String(choice);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-btn answer-btn-interval";
      button.dataset.choice = String(choice);
      button.innerHTML =
        `<span class="interval-number">${asNumber}</span>` +
        `<span class="interval-name">${label}</span>`;
      button.addEventListener("click", () => handlers.onChoice(choice));

      this._currentChoiceButtons.set(String(choice), button);
      this.elements.answerOptions.appendChild(button);
    });
  }

  #renderChoices(exercise, handlers, useIntervalLabel = false, useRhythmLabel = false) {
    exercise.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-btn";

      if (useRhythmLabel) {
        const label = exercise.metadata?.choiceLabels?.[choice] ?? choice;
        button.textContent = label;
      } else if (useIntervalLabel) {
        button.textContent = toIntervalLabel(choice);
      } else {
        button.textContent = String(choice);
      }

      button.addEventListener("click", () => {
        handlers.onChoice(choice);
      });

      this._currentChoiceButtons.set(String(choice), button);
      this.elements.answerOptions.appendChild(button);
    });
  }
}
