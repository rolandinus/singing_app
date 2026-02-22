import { describe, expect, it } from 'vitest';
import { SessionService } from '../core/services/session-service';
import { DEFAULT_SETTINGS } from '../core/config/curriculum';

function createMockStorage() {
  const progress: Record<string, any> = {};
  const sessions: any[] = [];
  let settings = { ...DEFAULT_SETTINGS };

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

describe('SessionService', () => {
  it('runs guided visual session end-to-end', async () => {
    const service = new SessionService(createMockStorage());
    await service.init();

    const started = service.startGuidedSession();
    expect(started.ok).toBe(true);

    const ex = service.getCurrentExercise();
    expect(ex).toBeTruthy();
    if (!ex) return;

    await service.submitChoice(String((ex.expectedAnswer as any).answer));
    const step = await service.nextExercise();
    expect(step.ok).toBe(true);

    const ended = await service.endSession();
    expect(ended?.summary.total).toBeGreaterThanOrEqual(1);
  });
});
