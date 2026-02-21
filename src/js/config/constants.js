export const SVG_NS = "http://www.w3.org/2000/svg";

export const STAFF_MARGIN_TOP = 40;
export const STAFF_MARGIN_LEFT = 20;
export const LINE_SPACING = 15;
export const STAFF_LINES_COUNT = 5;
export const SVG_STAFF_WIDTH = 800;
export const SVG_STAFF_HEIGHT = 180;
export const NOTE_HEAD_RX = LINE_SPACING * 0.6;
export const NOTE_HEAD_RY = LINE_SPACING * 0.45;
export const STEM_LENGTH = LINE_SPACING * 3.5;
export const NOTE_STROKE_WIDTH = 1.5;
export const ACCIDENTAL_OFFSET_X = -NOTE_HEAD_RX * 1.8;

export const LINE_COLOR = "black";
export const NOTE_COLOR_DEFAULT = "black";
export const NOTE_COLOR_WRONG = "red";
export const NOTE_HIGHLIGHT_COLOR = "#4ade80";

export const MIDDLE_LINE_D3_Y_GENERATED = STAFF_MARGIN_TOP + 2 * LINE_SPACING;
export const MIDDLE_LINE_D3_Y_RECORDED = STAFF_MARGIN_TOP + 2 * LINE_SPACING;

export const NOTE_PROPERTIES = {
  C2: { scientific: "C2", yFactor: -8, midi: 36 },
  D2: { scientific: "D2", yFactor: -7, midi: 38 },
  E2: { scientific: "E2", yFactor: -6, midi: 40 },
  F2: { scientific: "F2", yFactor: -5, midi: 41 },
  G2: { scientific: "G2", yFactor: -4, midi: 43 },
  A2: { scientific: "A2", yFactor: -3, midi: 45 },
  B2: { scientific: "B2", yFactor: -2, midi: 47 },
  C3: { scientific: "C3", yFactor: -1, midi: 48 },
  D3: { scientific: "D3", yFactor: 0, midi: 50 },
  E3: { scientific: "E3", yFactor: 1, midi: 52 },
  F3: { scientific: "F3", yFactor: 2, midi: 53 },
  G3: { scientific: "G3", yFactor: 3, midi: 55 },
  A3: { scientific: "A3", yFactor: 4, midi: 57 },
  B3: { scientific: "B3", yFactor: 5, midi: 59 },
  C4: { scientific: "C4", yFactor: 6, midi: 60 },
};

export const C_MAJOR_SCALE_NOTES_NAMES_ONLY = ["C", "D", "E", "F", "G", "A", "B"];

export const AVAILABLE_NOTES_SORTED = Object.keys(NOTE_PROPERTIES)
  .filter((key) => C_MAJOR_SCALE_NOTES_NAMES_ONLY.includes(key.slice(0, -1)))
  .sort((a, b) => NOTE_PROPERTIES[a].midi - NOTE_PROPERTIES[b].midi);

export const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SOLFEGE_MAP = {
  C: "do",
  D: "re",
  E: "mi",
  F: "fa",
  G: "sol",
  A: "la",
  B: "si",
};
