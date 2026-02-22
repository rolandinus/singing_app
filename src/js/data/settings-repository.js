import { CLEF_OPTIONS, DEFAULT_SETTINGS } from "../config/curriculum.js";

const SETTINGS_STORAGE_KEY = "sight_singing_settings_v1";

export class SettingsRepository {
  async load() {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        return structuredClone(DEFAULT_SETTINGS);
      }

      const parsed = JSON.parse(raw);
      return this.#sanitize(parsed);
    } catch (error) {
      console.error("Failed to load settings, using defaults:", error);
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  async save(settings) {
    const sanitized = this.#sanitize(settings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  }

  #sanitize(candidate) {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(candidate ?? {}),
      pitchToleranceCentsByLevel: {
        ...DEFAULT_SETTINGS.pitchToleranceCentsByLevel,
        ...(candidate?.pitchToleranceCentsByLevel ?? {}),
      },
    };

    const enabledSet = new Set((merged.enabledClefs ?? []).filter((clef) => CLEF_OPTIONS.includes(clef)));
    if (enabledSet.size === 0) {
      enabledSet.add(DEFAULT_SETTINGS.defaultClef);
    }

    const enabledClefs = Array.from(enabledSet);
    const defaultClef = enabledSet.has(merged.defaultClef) ? merged.defaultClef : enabledClefs[0];

    return {
      ...merged,
      enabledClefs,
      defaultClef,
      dailyGoalExercises: Number.isFinite(Number(merged.dailyGoalExercises))
        ? Math.max(5, Math.min(100, Number(merged.dailyGoalExercises)))
        : DEFAULT_SETTINGS.dailyGoalExercises,
    };
  }
}
