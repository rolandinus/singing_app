export const CLEF_OPTIONS = ["treble", "bass"];

export const SKILL_DEFINITIONS = [
  { key: "note_naming", family: "visual", label: "Notennamen" },
  { key: "interval_visual", family: "visual", label: "Intervalle (visuell)" },
  { key: "rhythm_id", family: "visual", label: "Rhythmen" },
  { key: "interval_aural", family: "aural", label: "Intervalle (gehör)" },
  { key: "sing_note", family: "singing", label: "Ton singen" },
  { key: "sing_interval", family: "singing", label: "Intervall singen" },
  { key: "sing_melody", family: "singing", label: "Melodien singen" },
];

export const SKILL_KEYS = SKILL_DEFINITIONS.map((skill) => skill.key);

export const INTERVAL_LABELS = {
  1: "Prime",
  2: "Sekunde",
  3: "Terz",
  4: "Quarte",
  5: "Quinte",
  6: "Sexte",
  7: "Septime",
  8: "Oktave",
};

export const RHYTHM_PATTERNS = [
  { key: "quarter-quarter-quarter-quarter", label: "Viertel Viertel Viertel Viertel", display: "♩ ♩ ♩ ♩" },
  { key: "half-half", label: "Halbe Halbe", display: "𝅗𝅥 𝅗𝅥" },
  { key: "half-quarter-quarter", label: "Halbe Viertel Viertel", display: "𝅗𝅥 ♩ ♩" },
  { key: "quarter-eighth-eighth-quarter", label: "Viertel Achtel Achtel Viertel", display: "♩ ♪ ♪ ♩" },
  { key: "eighth-eighth-eighth-eighth-quarter", label: "Achtel Achtel Achtel Achtel Viertel", display: "♪ ♪ ♪ ♪ ♩" },
];

export const SESSION_DISTRIBUTION = {
  focus: 0.4,
  mixed: 0.4,
  review: 0.2,
};

export const MAX_LEVEL = 5;
export const MASTERY_THRESHOLD = 0.85;
export const ROLLING_WINDOW_SIZE = 20;

export const DEFAULT_SETTINGS = {
  enabledClefs: ["treble", "bass"],
  defaultClef: "treble",
  dailyGoalExercises: 20,
  pitchToleranceCentsByLevel: {
    1: 50,
    2: 45,
    3: 40,
    4: 35,
    5: 30,
  },
};

export const CLEF_NOTE_RANGES = {
  treble: { minMidi: 60, maxMidi: 81 },
  bass: { minMidi: 40, maxMidi: 60 },
};
