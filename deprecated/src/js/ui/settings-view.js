import { CLEF_OPTIONS } from "../config/curriculum.js";

export class SettingsView {
  constructor(elements) {
    this.elements = elements;
  }

  render(settings) {
    this.elements.settingClefTreble.checked = settings.enabledClefs.includes("treble");
    this.elements.settingClefBass.checked = settings.enabledClefs.includes("bass");

    this.elements.settingDefaultClef.innerHTML = CLEF_OPTIONS
      .map((clef) => `<option value="${clef}">${clef}</option>`)
      .join("");

    this.elements.settingDefaultClef.value = settings.defaultClef;
    this.elements.settingDailyGoal.value = String(settings.dailyGoalExercises);
  }

  readValues() {
    const enabledClefs = [];
    if (this.elements.settingClefTreble.checked) {
      enabledClefs.push("treble");
    }
    if (this.elements.settingClefBass.checked) {
      enabledClefs.push("bass");
    }

    if (enabledClefs.length === 0) {
      enabledClefs.push("treble");
    }

    const defaultClef = enabledClefs.includes(this.elements.settingDefaultClef.value)
      ? this.elements.settingDefaultClef.value
      : enabledClefs[0];

    return {
      enabledClefs,
      defaultClef,
      dailyGoalExercises: Number.parseInt(this.elements.settingDailyGoal.value, 10) || 20,
    };
  }

  showStatus(text) {
    this.elements.settingsStatus.textContent = text;
  }
}
