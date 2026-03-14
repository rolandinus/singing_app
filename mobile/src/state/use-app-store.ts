import { create } from 'zustand';
import { DEFAULT_SETTINGS, SKILL_DEFINITIONS } from '../core/config/curriculum';
import { DEFAULT_MELODY_OPTIONS } from '../core/domain/exercise-generator';
import { SessionService, DEFAULT_MELODY_BPM, COUNT_IN_BEATS, type MelodyNoteResult } from '../core/services/session-service';
import type { AppSettings, Clef, Exercise, ExerciseFamily, MelodyOptions, SessionRecord, SessionSummary, SkillKey } from '../core/types';
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
  /** Melody-specific generation options, shown only when sing_melody is selected. */
  selectedMelodyOptions: MelodyOptions;
  /** Index of the note currently being sung during a recording attempt, or null when not recording. */
  singingNoteIndex: number | null;
  pitchDebug: PitchDebugState;
  /** BPM used for melody playback and capture timing. */
  melodyBpm: number;
  /** Current count-in beat (1–4) during count-in phase, null otherwise. */
  melodyCountInBeat: number | null;
  /** Per-note correctness results after a melody attempt. */
  melodyNoteResults: MelodyNoteResult[];
  loading: {
    startGuided: boolean;
    startCustom: boolean;
    submitChoice: boolean;
    playPrompt: boolean;
    captureSingingAttempt: boolean;
    nextExercise: boolean;
    endSession: boolean;
    saveSettings: boolean;
    stopPlayback: boolean;
  };
  bootstrap: () => Promise<void>;
  refreshDashboard: () => void;
  startGuided: () => Promise<void>;
  startCustom: () => Promise<void>;
  submitChoice: (choice: string) => Promise<void>;
  playPrompt: () => Promise<void>;
  /** Play melody prompt using BPM-aware timing. */
  playMelodyPrompt: () => Promise<void>;
  captureSingingAttempt: () => Promise<void>;
  /** Stop active prompt playback. */
  stopPlayback: () => Promise<void>;
  /** Regenerate the current melody exercise with a new melody. */
  regenerateMelody: () => void;
  /** Audition a single note by name (tap on staff). */
  auditMelodyNote: (note: string) => Promise<void>;
  /** Set the BPM for melody trainer. */
  setMelodyBpm: (bpm: number) => void;
  nextExercise: () => Promise<void>;
  /** Discard the active session immediately without saving results or showing a summary. */
  abortSession: () => void;
  endSession: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setSelectedFamily: (value: ExerciseFamily) => void;
  setSelectedSkill: (value: SkillKey) => void;
  setSelectedClef: (value: Clef) => void;
  setSelectedLevel: (value: number) => void;
  setSelectedCount: (value: number) => void;
  setSelectedMelodyOptions: (value: Partial<MelodyOptions>) => void;
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
  selectedMelodyOptions: { ...DEFAULT_MELODY_OPTIONS },
  singingNoteIndex: null,
  pitchDebug: { ...INITIAL_PITCH_DEBUG_STATE },
  melodyBpm: DEFAULT_MELODY_BPM,
  melodyCountInBeat: null,
  melodyNoteResults: [],
  loading: {
    startGuided: false,
    startCustom: false,
    submitChoice: false,
    playPrompt: false,
    captureSingingAttempt: false,
    nextExercise: false,
    endSession: false,
    saveSettings: false,
    stopPlayback: false,
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
      melodyBpm: settings.bpm,
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

      // Validate melody options before starting: require at least one interval step.
      if (state.selectedSkill === 'sing_melody' && state.selectedMelodyOptions.allowedIntervalSteps.length === 0) {
        set({ feedback: { text: 'Mindestens ein Intervall muss ausgewählt sein.', isCorrect: false } });
        return;
      }

      const started = service.startCustomSession({
        skillKey: state.selectedSkill,
        clef: state.selectedClef,
        level: state.selectedLevel,
        count: state.selectedCount,
        melodyOptions: state.selectedSkill === 'sing_melody' ? state.selectedMelodyOptions : undefined,
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

  async playMelodyPrompt() {
    if (get().loading.playPrompt) return;
    set((state) => ({ loading: { ...state.loading, playPrompt: true } }));
    try {
      await service.playMelodyWithTiming(get().melodyBpm);
    } finally {
      set((state) => ({ loading: { ...state.loading, playPrompt: false } }));
    }
  },

  async stopPlayback() {
    if (get().loading.stopPlayback) return;
    set((state) => ({ loading: { ...state.loading, stopPlayback: true } }));
    try {
      await service.stopPrompt();
    } finally {
      set((state) => ({ loading: { ...state.loading, stopPlayback: false, playPrompt: false } }));
    }
  },

  regenerateMelody() {
    const newExercise = service.regenerateMelody();
    if (newExercise) {
      set({
        currentExercise: newExercise,
        feedback: { text: '', isCorrect: false },
        answerState: { selectedChoice: null, expectedChoice: null },
        melodyNoteResults: [],
        singingNoteIndex: null,
      });
    }
  },

  async auditMelodyNote(note: string) {
    await service.auditNote(note);
  },

  setMelodyBpm(bpm: number) {
    const clamped = Math.max(40, Math.min(200, bpm));
    set({ melodyBpm: clamped });
    void service.saveSettings({ bpm: clamped });
  },

  async captureSingingAttempt() {
    if (get().loading.captureSingingAttempt) return;
    set((state) => ({
      loading: { ...state.loading, captureSingingAttempt: true },
      singingNoteIndex: null,
      melodyCountInBeat: null,
      pitchDebug: {
        ...INITIAL_PITCH_DEBUG_STATE,
        timestampMs: Date.now(),
        message: 'capture_requested',
      },
    }));

    const exercise = get().currentExercise;
    const timers: ReturnType<typeof setTimeout>[] = [];

    try {
      if (exercise?.skillKey === 'sing_interval') {
        // Drive note highlight for sing_interval: reference then target after ~1s.
        set({ singingNoteIndex: 0 });
        timers.push(setTimeout(() => set({ singingNoteIndex: 1 }), 1000));

        const outcome = await service.captureSingingAttempt();
        if (!outcome) return;

        set({
          feedback: { text: outcome.feedback, isCorrect: outcome.evaluation.correct },
          answerState: { selectedChoice: null, expectedChoice: null },
          sessionMeta: service.getSessionMeta(),
          singingNoteIndex: null,
        });
        get().refreshDashboard();
      } else if (exercise?.skillKey === 'sing_melody') {
        const bpm = get().melodyBpm;

        // Clear previous note results.
        set({ melodyNoteResults: [] });

        const outcome = await service.captureSingingAttempt({
          bpm,
          onCountInBeat: (beat) => {
            set({ melodyCountInBeat: beat });
          },
          onNoteIndex: (index) => {
            set({ singingNoteIndex: index, melodyCountInBeat: null });
          },
        });

        if (!outcome) return;

        set({
          feedback: { text: outcome.feedback, isCorrect: outcome.evaluation.correct },
          answerState: { selectedChoice: null, expectedChoice: null },
          sessionMeta: service.getSessionMeta(),
          singingNoteIndex: null,
          melodyCountInBeat: null,
          melodyNoteResults: outcome.noteResults ?? [],
        });
        get().refreshDashboard();
      } else {
        // Generic singing (sing_note).
        const outcome = await service.captureSingingAttempt();
        if (!outcome) return;

        set({
          feedback: { text: outcome.feedback, isCorrect: outcome.evaluation.correct },
          answerState: { selectedChoice: null, expectedChoice: null },
          sessionMeta: service.getSessionMeta(),
          singingNoteIndex: null,
        });
        get().refreshDashboard();
      }
    } finally {
      timers.forEach(clearTimeout);
      set((state) => ({ loading: { ...state.loading, captureSingingAttempt: false }, singingNoteIndex: null, melodyCountInBeat: null }));
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
        melodyNoteResults: [],
        melodyCountInBeat: null,
        singingNoteIndex: null,
      });
    } finally {
      set((state) => ({ loading: { ...state.loading, nextExercise: false } }));
    }
  },

  abortSession() {
    service.abortSession();
    set({
      currentExercise: null,
      sessionMeta: { mode: 'guided', index: 0, total: 0 },
      feedback: { text: '', isCorrect: false },
      answerState: { selectedChoice: null, expectedChoice: null },
      melodyNoteResults: [],
      melodyCountInBeat: null,
      singingNoteIndex: null,
      summary: null,
    });
    get().refreshDashboard();
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
      const next: Partial<StoreState> = { settings };
      if (partial.bpm !== undefined) {
        next.melodyBpm = settings.bpm;
      }
      set(next);
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
  setSelectedMelodyOptions(partial) {
    set((state) => ({ selectedMelodyOptions: { ...state.selectedMelodyOptions, ...partial } }));
  },
  clearSummary() { set({ summary: null }); },
}));
