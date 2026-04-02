export const SVG_STAFF_WIDTH = 800;
export const STAFF_MARGIN_LEFT = 15;
export const STAFF_LINES_COUNT = 5;

// Single knob: increase LINE_SPACING to scale the entire staff up.
export const LINE_SPACING = 22;

// Derived from LINE_SPACING — do not set these independently.
export const STAFF_MARGIN_TOP = Math.round(LINE_SPACING * (8 / 3));   // ≈40 at 15
export const SVG_STAFF_HEIGHT = LINE_SPACING * 12;                     // =180 at 15
