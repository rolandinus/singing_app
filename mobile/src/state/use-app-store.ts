import { create } from 'zustand';
import { DEFAULT_SETTINGS, SKILL_DEFINITIONS } from '../core/config/curriculum';
import { SessionService } from '../core/services/session-service';
import type { AppSettings, Clef, Exercise, ExerciseFamily, SessionRecord, SessionSummary, SkillKey } from '../core/types';
import { AsyncStoragePort } from '../adapters/storage/async-storage-port';
import { ExpoAudioPromptPort } from '../adapters/audio/expo-audio-prompt-port';
import { ExpoPitchCapturePort, type PitchCaptureDebugSnapshot } from '../adapters/pitch/expo-pitch-capture-port';

const pitchCapturePort = new ExpoPitchCapturePort();
const service = new SessionService(new AsyncStoragePort(), new ExpoAudioPromptPort(), pitchCapturePort);

function logStoreDebug(stage: string, details: Record<string, unknown> = {}) {
  console.log(`[store:end-session] ${stage}`, details);
}

type PitchDebugState = {
  phase: PitchCaptureDebugSnapshot['phase'];
  timestampMs: number | null;
  durationMillis: number;
  metering: number | null;
  frequency: number | null;
  sampleTimeMs: number | null;
  timelinePoints: number;
  uri: string | null;
  message: string;
};

const INITIAL_PITCH_DEBUG_STATE: PitchDebugState = {
  phase: 'idle',
  timestampMs: null,
  durationMillis: 0,
  metering: null,
  frequency: null,
  sampleTimeMs: null,
  timelinePoints: 0,
  uri: null,
  message: '',
};

function mergePitchDebugState(previous: PitchDebugState, snapshot: PitchCaptureDebugSnapshot): PitchDebugState {
  const next: PitchDebugState = {
    ...previous,
    phase: snapshot.phase,
    timestampMs: snapshot.timestampMs,
  };

  if (snapshot.durationMillis !== undefined) next.durationMillis = snapshot.durationMillis;
  if (snapshot.metering !== undefined) next.metering = snapshot.metering;
  if (snapshot.frequency !== undefined) next.frequency = snapshot.frequency;
  if (snapshot.sampleTimeMs !== undefined) next.sampleTimeMs = snapshot.sampleTimeMs;
  if (snapshot.timelinePoints !== undefined) next.timelinePoints = snapshot.timelinePoints;
  if (snapshot.uri !== undefined) next.uri = snapshot.uri;
  if (snapshot.message !== undefined) next.message = snapshot.message;

  return next;
}

type StoreState = {
  bootstrapped: boolean;
  settings: AppSettings;
  recentSessions: SessionRecord[];
  skillRows: Array<{ clef: Clef; skillKey: SkillKey; level: number; mastery: number; attemptsTotal: number }>;
  currentExercise: Exercise | null;
  sessionMeta: { mode: 'guided' | 'custom'; index: number; total: number };
  feedback: { text: string; isCorrect: boolean };
  answerState: { selectedChoice: string | null; expectedChoice: string | null };
  summary: SessionSummary | null;
  selectedFamily: ExerciseFamily;
  selectedSkill: SkillKey;
  selectedClef: Clef;
  selectedLevel: number;
  selectedCount: number;
  /** Index of the note currently being sung during a recording attempt, or null when not recording. */
  singingNoteIndex: number | null;
  pitchDebug: PitchDebugState;
  loading: {
    startGuided: boolean;
    startCustom: boolean;
    submitChoice: boolean;
    playPrompt: boolean;
    captureSingingAttempt: boolean;
    nextExercise: boolean;
    endSession: boolean;
    saveSettings: boolean;
  };
  bootstrap: () => Promise<void>;
  refreshDashboard: () => void;
  startGuided: () => Promise<void>;
  startCustom: () => Promise<void>;
  submitChoice: (choice: string) => Promise<void>;
  playPrompt: () => Promise<void>;
  captureSingingAttempt: () => Promise<void>;
  nextExercise: () => Promise<void>;
  endSession: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setSelectedFamily: (value: ExerciseFamily) => void;
  setSelectedSkill: (value: SkillKey) => void;
  setSelectedClef: (value: Clef) => void;
  setSelectedLevel: (value: number) => void;
  setSelectedCount: (value: number) => void;
  clearSummary: () => void;
};

function firstSkillForFamily(family: ExerciseFamily): SkillKey {
  return (SKILL_DEFINITIONS.find((s) => s.family === family)?.key ?? 'note_naming') as SkillKey;
}

export const useAppStore = create<StoreState>((set, get) => ({
  bootstrapped: false,
  settings: { ...DEFAULT_SETTINGS },
  recentSessions: [],
  skillRows: [],
  currentExercise: null,
  sessionMeta: { mode: 'guided', index: 0, total: 0 },
  feedback: { text: '', isCorrect: false },
  answerState: { selectedChoice: null, expectedChoice: null },
  summary: null,
  selectedFamily: 'visual',
  selectedSkill: firstSkillForFamily('visual'),
  selectedClef: 'treble',
  selectedLevel: 1,
  selectedCount: 10,
  singingNoteIndex: null,
  pitchDebug: { ...INITIAL_PITCH_DEBUG_STATE },
  loading: {
    startGuided: false,
    startCustom: false,
    submitChoice: false,
    playPrompt: false,
    captureSingingAttempt: false,
    nextExercise: false,
    endSession: false,
    saveSettings: false,
  },

  async bootstrap() {
    service.setPitchDebugListener((snapshot) => {
      set((state) => ({ pitchDebug: mergePitchDebugState(state.pitchDebug, snapshot as PitchCaptureDebugSnapshot) }));
    });

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

  async startGuided() {
    set((state) => ({ loading: { ...state.loading, startGuided: true } }));
    try {
      const started = service.startGuidedSession();
      if (!started.ok) {
        set({ feedback: { text: started.error, isCorrect: false } });
        return;
      }

      set({
        currentExercise: service.getCurrentExercise(),
        sessionMeta: service.getSessionMeta(),
        feedback: { text: '', isCorrect: false },
        answerState: { selectedChoice: null, expectedChoice: null },
        summary: null,
      });
    } finally {
      set((state) => ({ loading: { ...state.loading, startGuided: false } }));
    }
  },

  async startCustom() {
    set((state) => ({ loading: { ...state.loading, startCustom: true } }));
    try {
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
        answerState: { selectedChoice: null, expectedChoice: null },
        summary: null,
      });
    } finally {
      set((state) => ({ loading: { ...state.loading, startCustom: false } }));
    }
  },

  async submitChoice(choice: string) {
    if (get().loading.submitChoice) return;
    set((state) => ({ loading: { ...state.loading, submitChoice: true } }));
    try {
      const outcome = await service.submitChoice(choice);
      if (!outcome) return;

      set({
        feedback: { text: outcome.feedback, isCorrect: outcome.evaluation.correct },
        answerState: {
          selectedChoice: outcome.selectedChoice,
          expectedChoice: outcome.expectedChoice,
        },
        sessionMeta: service.getSessionMeta(),
      });
      get().refreshDashboard();
    } finally {
      set((state) => ({ loading: { ...state.loading, submitChoice: false } }));
    }
  },

  async playPrompt() {
    if (get().loading.playPrompt) return;
    set((state) => ({ loading: { ...state.loading, playPrompt: true } }));
    try {
      await service.playPrompt();
    } finally {
      set((state) => ({ loading: { ...state.loading, playPrompt: false } }));
    }
  },

  async captureSingingAttempt() {
    if (get().loading.captureSingingAttempt) return;
    set((state) => ({
      loading: { ...state.loading, captureSingingAttempt: true },
      singingNoteIndex: null,
      pitchDebug: {
        ...INITIAL_PITCH_DEBUG_STATE,
        timestampMs: Date.now(),
        message: 'capture_requested',
      },
    }));

    const exercise = get().currentExercise;
    const timers: ReturnType<typeof setTimeout>[] = [];

    try {
      // Drive note highlight during recording:
      // - sing_interval: highlight reference note (index 0) first, then target (index 1) after ~1 s
      // - sing_melody: advance through each note at ~900 ms per note
      if (exercise?.skillKey === 'sing_interval') {
        set({ singingNoteIndex: 0 });
        timers.push(setTimeout(() => set({ singingNoteIndex: 1 }), 1000));
      } else if (exercise?.skillKey === 'sing_melody') {
        const noteCount = Array.isArray((exercise.prompt as Record<string, unknown>).notes)
          ? ((exercise.prompt as Record<string, unknown>).notes as unknown[]).length
          : 0;
        set({ singingNoteIndex: 0 });
        for (let i = 1; i < noteCount; i += 1) {
          const delay = i * 900;
          timers.push(setTimeout(() => set({ singingNoteIndex: i }), delay));
        }
      }

      const outcome = await service.captureSingingAttempt();
      if (!outcome) return;

      set({
        feedback: { text: outcome.feedback, isCorrect: outcome.evaluation.correct },
        answerState: { selectedChoice: null, expectedChoice: null },
        sessionMeta: service.getSessionMeta(),
        singingNoteIndex: null,
      });
      get().refreshDashboard();
    } finally {
      timers.forEach(clearTimeout);
      set((state) => ({ loading: { ...state.loading, captureSingingAttempt: false }, singingNoteIndex: null }));
    }
  },

  async nextExercise() {
    if (get().loading.nextExercise) return;
    set((state) => ({ loading: { ...state.loading, nextExercise: true } }));
    try {
      const result = await service.nextExercise();
      if (!result.ok) return;

      if (result.ended) {
        set({
          summary: result.summary,
          currentExercise: null,
          sessionMeta: { mode: 'guided', index: 0, total: 0 },
          answerState: { selectedChoice: null, expectedChoice: null },
        });
        get().refreshDashboard();
        return;
      }

      set({
        currentExercise: service.getCurrentExercise(),
        sessionMeta: service.getSessionMeta(),
        feedback: { text: '', isCorrect: false },
        answerState: { selectedChoice: null, expectedChoice: null },
      });
    } finally {
      set((state) => ({ loading: { ...state.loading, nextExercise: false } }));
    }
  },

  async endSession() {
    if (get().loading.endSession) {
      logStoreDebug('skipped_already_loading');
      return;
    }
    const stateBefore = get();
    logStoreDebug('requested', {
      hasCurrentExercise: Boolean(stateBefore.currentExercise),
      sessionMode: stateBefore.sessionMeta.mode,
      sessionIndex: stateBefore.sessionMeta.index,
      sessionTotal: stateBefore.sessionMeta.total,
    });
    set((state) => ({ loading: { ...state.loading, endSession: true } }));
    try {
      const ended = await service.endSession();
      if (!ended) {
        logStoreDebug('service_returned_null');
        return;
      }

      logStoreDebug('service_returned_summary', {
        mode: ended.summary.mode,
        total: ended.summary.total,
        correct: ended.summary.correct,
      });

      set({
        summary: ended.summary,
        currentExercise: null,
        sessionMeta: { mode: 'guided', index: 0, total: 0 },
        answerState: { selectedChoice: null, expectedChoice: null },
      });
      logStoreDebug('state_updated_with_summary', {
        hasSummary: Boolean(get().summary),
      });
      get().refreshDashboard();
    } catch (error) {
      console.error('[store:end-session] failed', error);
      throw error;
    } finally {
      set((state) => ({ loading: { ...state.loading, endSession: false } }));
      logStoreDebug('loading_reset', {
        loading: get().loading.endSession,
      });
    }
  },

  async saveSettings(partial: Partial<AppSettings>) {
    set((state) => ({ loading: { ...state.loading, saveSettings: true } }));
    try {
      const settings = await service.saveSettings(partial);
      set({ settings });
      get().refreshDashboard();
    } finally {
      set((state) => ({ loading: { ...state.loading, saveSettings: false } }));
    }
  },

  setSelectedFamily(value) {
    set({
      selectedFamily: value,
      selectedSkill: firstSkillForFamily(value),
    });
  },
  setSelectedSkill(value) { set({ selectedSkill: value }); },
  setSelectedClef(value) { set({ selectedClef: value }); },
  setSelectedLevel(value) { set({ selectedLevel: Math.max(1, Math.min(5, value)) }); },
  setSelectedCount(value) { set({ selectedCount: Math.max(1, Math.min(50, value)) }); },
  clearSummary() { set({ summary: null }); },
}));
