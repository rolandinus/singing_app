import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/config/curriculum';
import { SessionService } from '../core/services/session-service';

function createMockStorage(initialLocale: 'de' | 'en' = 'de') {
  const progress: Record<string, any> = {};
  const sessions: any[] = [];
  let settings = { ...DEFAULT_SETTINGS, locale: initialLocale };

  return {
    async init() {},
    async loadSettings() { return settings; },
    async saveSettings(next: any) { settings = next; return settings; },
    async getAllProgress() { return Object.values(progress); },
    async saveProgress(record: any) { progress[record.skillKey] = record; return record; },
    async saveSession(session: any) { sessions.push(session); return session; },
    async getRecentSessions(limit = 20) { return sessions.slice(0, limit); },
  };
}

describe('SessionService locale flow', () => {
  it('loads locale from storage and persists locale updates', async () => {
    const storage = createMockStorage('en');
    const service = new SessionService(storage);

    await service.init();
    expect(service.getSettings().locale).toBe('en');

    const next = await service.saveSettings({ locale: 'de' });
    expect(next.locale).toBe('de');
    expect(service.getSettings().locale).toBe('de');
  });
});
