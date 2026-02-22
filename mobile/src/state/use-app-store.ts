import { create } from 'zustand';
import { DEFAULT_SETTINGS, SKILL_DEFINITIONS } from '../core/config/curriculum';
import { SessionService } from '../core/services/session-service';
import type { AppSettings, Clef, Exercise, SessionSummary, SkillKey } from '../core/types';
import { AsyncStoragePort } from '../adapters/storage/async-storage-port';

const service = new SessionService(new AsyncStoragePort());

type StoreState = {
  bootstrapped: boolean;
  settings: AppSettings;
  recentSessions: any[];
  skillRows: Array<{ clef: Clef; skillKey: SkillKey; level: number; mastery: number; attemptsTotal: number }>;
  currentExercise: Exercise | null;
  sessionMeta: { mode: 'guided' | 'custom'; index: number; total: number };
  feedback: { text: string; isCorrect: boolean };
  summary: SessionSummary | null;
  selectedFamily: 'visual' | 'aural' | 'singing';
  selectedSkill: SkillKey;
  selectedClef: Clef;
  selectedLevel: number;
  selectedCount: number;
  bootstrap: () => Promise<void>;
  refreshDashboard: () => void;
  startGuided: () => void;
  startCustom: () => void;
  submitChoice: (choice: string) => Promise<void>;
  nextExercise: () => Promise<void>;
  endSession: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setSelectedFamily: (value: 'visual' | 'aural' | 'singing') => void;
  setSelectedSkill: (value: SkillKey) => void;
  setSelectedClef: (value: Clef) => void;
  setSelectedLevel: (value: number) => void;
  setSelectedCount: (value: number) => void;
  clearSummary: () => void;
};

function firstVisualSkill(): SkillKey {
  return (SKILL_DEFINITIONS.find((s) => s.family === 'visual')?.key ?? 'note_naming') as SkillKey;
}

export const useAppStore = create<StoreState>((set, get) => ({
  bootstrapped: false,
  settings: { ...DEFAULT_SETTINGS },
  recentSessions: [],
  skillRows: [],
  currentExercise: null,
  sessionMeta: { mode: 'guided', index: 0, total: 0 },
  feedback: { text: '', isCorrect: false },
  summary: null,
  selectedFamily: 'visual',
  selectedSkill: firstVisualSkill(),
  selectedClef: 'treble',
  selectedLevel: 1,
  selectedCount: 10,

  async bootstrap() {
    await service.init();
    const settings = service.getSettings();
    const clefs = service.getClefChoices();
    set({
      bootstrapped: true,
      settings,
      recentSessions: service.getRecentSessions(),
      skillRows: service.buildSkillRows(),
      selectedClef: clefs.includes(settings.defaultClef) ? settings.defaultClef : clefs[0],
    });
  },

  refreshDashboard() {
    set({
      recentSessions: service.getRecentSessions(),
      skillRows: service.buildSkillRows(),
    });
  },

  startGuided() {
    const started = service.startGuidedSession();
    if (!started.ok) {
      set({ feedback: { text: started.error, isCorrect: false } });
      return;
    }

    set({
      currentExercise: service.getCurrentExercise(),
      sessionMeta: service.getSessionMeta(),
      feedback: { text: '', isCorrect: false },
      summary: null,
    });
  },

  startCustom() {
    const state = get();
    const started = service.startCustomSession({
      skillKey: state.selectedSkill,
      clef: state.selectedClef,
      level: state.selectedLevel,
      count: state.selectedCount,
    });

    if (!started.ok) {
      set({ feedback: { text: started.error, isCorrect: false } });
      return;
    }

    set({
      currentExercise: service.getCurrentExercise(),
      sessionMeta: service.getSessionMeta(),
      feedback: { text: '', isCorrect: false },
      summary: null,
    });
  },

  async submitChoice(choice: string) {
    const outcome = await service.submitChoice(choice);
    if (!outcome) return;

    set({
      feedback: { text: outcome.feedback, isCorrect: outcome.evaluation.correct },
      sessionMeta: service.getSessionMeta(),
    });
    get().refreshDashboard();
  },

  async nextExercise() {
    const result = await service.nextExercise();
    if (!result.ok) return;

    if (result.ended) {
      set({
        summary: result.summary,
        currentExercise: null,
        sessionMeta: { mode: 'guided', index: 0, total: 0 },
      });
      get().refreshDashboard();
      return;
    }

    set({
      currentExercise: service.getCurrentExercise(),
      sessionMeta: service.getSessionMeta(),
      feedback: { text: '', isCorrect: false },
    });
  },

  async endSession() {
    const ended = await service.endSession();
    if (!ended) return;

    set({
      summary: ended.summary,
      currentExercise: null,
      sessionMeta: { mode: 'guided', index: 0, total: 0 },
    });
    get().refreshDashboard();
  },

  async saveSettings(partial: Partial<AppSettings>) {
    const settings = await service.saveSettings(partial);
    set({ settings });
    get().refreshDashboard();
  },

  setSelectedFamily(value) {
    const first = (SKILL_DEFINITIONS.find((s) => s.family === value)?.key ?? firstVisualSkill()) as SkillKey;
    set({ selectedFamily: value, selectedSkill: first });
  },
  setSelectedSkill(value) { set({ selectedSkill: value }); },
  setSelectedClef(value) { set({ selectedClef: value }); },
  setSelectedLevel(value) { set({ selectedLevel: Math.max(1, Math.min(5, value)) }); },
  setSelectedCount(value) { set({ selectedCount: Math.max(1, Math.min(50, value)) }); },
  clearSummary() { set({ summary: null }); },
}));
