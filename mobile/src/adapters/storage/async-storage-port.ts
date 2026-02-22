import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLEF_OPTIONS, DEFAULT_SETTINGS } from '../../core/config/curriculum';
import type { AppSettings, ProgressRecord, SessionRecord } from '../../core/types';

const SETTINGS_KEY = 'ss_mobile_settings_v1';
const DATA_KEY = 'ss_mobile_data_v1';

type PersistedData = {
  progress: Record<string, ProgressRecord>;
  sessions: SessionRecord[];
};

function sanitizeSettings(candidate: Partial<AppSettings> | null | undefined): AppSettings {
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(candidate ?? {}),
    pitchToleranceCentsByLevel: {
      ...DEFAULT_SETTINGS.pitchToleranceCentsByLevel,
      ...((candidate?.pitchToleranceCentsByLevel ?? {}) as Record<number, number>),
    },
  };

  const enabledSet = new Set((merged.enabledClefs ?? []).filter((clef) => CLEF_OPTIONS.includes(clef)));
  if (enabledSet.size === 0) {
    enabledSet.add(DEFAULT_SETTINGS.defaultClef);
  }

  const enabledClefs = Array.from(enabledSet) as AppSettings['enabledClefs'];
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

export class AsyncStoragePort {
  private cache: PersistedData = { progress: {}, sessions: [] };

  async init(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedData>;
        this.cache = {
          progress: parsed.progress ?? {},
          sessions: parsed.sessions ?? [],
        };
      }
    } catch {
      this.cache = { progress: {}, sessions: [] };
    }
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return sanitizeSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const sanitized = sanitizeSettings(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitized));
    return sanitized;
  }

  async getAllProgress(): Promise<ProgressRecord[]> {
    return Object.values(this.cache.progress);
  }

  async saveProgress(progressRecord: ProgressRecord): Promise<ProgressRecord> {
    this.cache.progress[progressRecord.skillKey] = progressRecord;
    await this.persistData();
    return progressRecord;
  }

  async saveSession(sessionRecord: SessionRecord): Promise<SessionRecord> {
    this.cache.sessions.push(sessionRecord);
    this.cache.sessions = this.cache.sessions
      .sort((a, b) => +new Date(b.completedAt) - +new Date(a.completedAt))
      .slice(0, 100);
    await this.persistData();
    return sessionRecord;
  }

  async getRecentSessions(limit = 20): Promise<SessionRecord[]> {
    return [...this.cache.sessions]
      .sort((a, b) => +new Date(b.completedAt) - +new Date(a.completedAt))
      .slice(0, limit);
  }

  private async persistData(): Promise<void> {
    await AsyncStorage.setItem(DATA_KEY, JSON.stringify(this.cache));
  }
}
