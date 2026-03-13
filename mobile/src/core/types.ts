export type Clef = 'treble' | 'bass';
export type Locale = 'de' | 'en';
export type ExerciseFamily = 'visual' | 'aural' | 'singing';

/** First-note selection mode for melody generation. */
export type MelodyFirstNoteMode = 'random' | 'C2' | 'C4';

/** Configurable options for sing_melody exercise generation. */
export type MelodyOptions = {
  /** Which note to start the melody on. */
  firstNoteMode: MelodyFirstNoteMode;
  /** Diatonic interval steps (1–8) allowed when building successive notes. */
  allowedIntervalSteps: number[];
};
export type SkillKey =
  | 'note_naming'
  | 'interval_visual'
  | 'rhythm_id'
  | 'interval_aural'
  | 'sing_note'
  | 'sing_interval'
  | 'sing_melody';

export type Exercise = {
  id: string;
  family: ExerciseFamily;
  skillKey: SkillKey;
  level: number;
  clef: Clef;
  prompt: Record<string, unknown>;
  choices: string[];
  expectedAnswer: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type EvaluationResult = {
  correct: boolean;
  score: number;
  accuracyDetail: Record<string, unknown>;
  feedback: string;
  telemetry: Record<string, unknown>;
};

export type ProgressRecord = {
  skillKey: string;
  level: number;
  mastery: number;
  attemptsTotal: number;
  correctTotal: number;
  rolling: boolean[];
  readyToLevelUp: boolean;
  lastPracticedAt: string | null;
};

export type SessionSummary = {
  mode: 'guided' | 'custom';
  total: number;
  correct: number;
  accuracy: number;
  practicedSkills?: Array<{
    clef: Clef;
    skillKey: SkillKey;
    masteryBefore: number;
    masteryAfter: number;
    masteryDelta: number;
    levelBefore: number;
    levelAfter: number;
  }>;
  streakDays?: number;
};

export type SessionRecord = {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  mode: 'guided' | 'custom';
  exercises: Array<{
    exerciseId: string;
    skillKey: string;
    clef: Clef;
    correct: boolean;
    score: number;
    submission: unknown;
    evaluatedAt: string;
  }>;
  summary: SessionSummary;
};

export type AppSettings = {
  enabledClefs: Clef[];
  defaultClef: Clef;
  dailyGoalExercises: number;
  pitchToleranceCentsByLevel: Record<number, number>;
  locale: Locale;
};
