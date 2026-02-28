export type Clef = 'treble' | 'bass';
export type Locale = 'de' | 'en';
export type ExerciseFamily = 'visual' | 'aural' | 'singing';
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
