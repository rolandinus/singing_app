import {
  LINE_COLOR,
  LINE_SPACING,
  NOTE_COLOR_DEFAULT,
  NOTE_HEAD_RX,
  NOTE_HEAD_RY,
  NOTE_STROKE_WIDTH,
  STAFF_LINES_COUNT,
  STAFF_MARGIN_LEFT,
  STAFF_MARGIN_TOP,
  STEM_LENGTH,
  SVG_NS,
  SVG_STAFF_WIDTH,
} from "../config/constants.js";
import { scientificToDiatonicIndex } from "../utils/note-helpers.js";
import { appendSvgModel } from "./svg-dom-renderer.js";
import { ellipse, group, line, text } from "./staff-model.js";

const CLEF_ANCHOR_BY_MIDDLE_LINE = {
  treble: "B4",
  bass: "D3",
};

const CLEF_SYMBOL = {
  treble: "𝄞",
  bass: "𝄢",
};

function getYFactor(scientific, clef) {
  const anchor = CLEF_ANCHOR_BY_MIDDLE_LINE[clef] ?? CLEF_ANCHOR_BY_MIDDLE_LINE.treble;
  const noteIndex = scientificToDiatonicIndex(scientific);
  const anchorIndex = scientificToDiatonicIndex(anchor);

  if (noteIndex === null || anchorIndex === null) {
    return null;
  }

  return noteIndex - anchorIndex;
}

function buildLedgerLineModel(middleLineY, xPosition, yFactor) {
  const nodes = [];
  const ledgerWidth = NOTE_HEAD_RX * 2.5;
  const x1 = xPosition - ledgerWidth / 2;
  const x2 = xPosition + ledgerWidth / 2;
  const step = LINE_SPACING / 2;

  if (yFactor <= -6) {
    for (let factor = -6; factor >= yFactor; factor -= 2) {
      nodes.push(
        line({
          x1,
          y1: middleLineY + Math.abs(factor) * step,
          x2,
          y2: middleLineY + Math.abs(factor) * step,
          stroke: LINE_COLOR,
          "stroke-width": 1,
        }),
      );
    }
  }

  if (yFactor >= 6) {
    for (let factor = 6; factor <= yFactor; factor += 2) {
      nodes.push(
        line({
          x1,
          y1: middleLineY - factor * step,
          x2,
          y2: middleLineY - factor * step,
          stroke: LINE_COLOR,
          "stroke-width": 1,
        }),
      );
    }
  }

  return nodes;
}

function buildClefSymbolModel(clef, middleLineY) {
  const symbol = CLEF_SYMBOL[clef] ?? CLEF_SYMBOL.treble;
  const x = STAFF_MARGIN_LEFT + 24;
  const y = middleLineY + (clef === "treble" ? 23 : 8);

  return text(
    {
      x,
      y,
      "font-size": clef === "treble" ? 64 : 56,
      "font-family": "Bravura, Noto Music, serif",
      fill: NOTE_COLOR_DEFAULT,
    },
    symbol,
  );
}

export function buildLearningStaffModel({
  clef = "treble",
  middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING,
} = {}) {
  const nodes = [];

  for (let lineIndex = 0; lineIndex < STAFF_LINES_COUNT; lineIndex += 1) {
    const y = STAFF_MARGIN_TOP + lineIndex * LINE_SPACING;
    nodes.push(
      line({
        x1: STAFF_MARGIN_LEFT,
        y1: y,
        x2: SVG_STAFF_WIDTH - STAFF_MARGIN_LEFT,
        y2: y,
        stroke: LINE_COLOR,
        "stroke-width": 1,
      }),
    );
  }

  nodes.push(buildClefSymbolModel(clef, middleLineY));
  return nodes;
}

export function buildLearningNoteModel({
  scientific,
  xPosition,
  clef = "treble",
  noteColor = NOTE_COLOR_DEFAULT,
  withLabel = false,
  middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING,
}) {
  const yFactor = getYFactor(scientific, clef);
  if (yFactor === null) {
    return null;
  }

  const y = middleLineY - yFactor * (LINE_SPACING / 2);
  const childNodes = [
    ...buildLedgerLineModel(middleLineY, xPosition, yFactor),
    ellipse({
      cx: xPosition,
      cy: y,
      rx: NOTE_HEAD_RX,
      ry: NOTE_HEAD_RY,
      fill: noteColor,
      stroke: noteColor,
      "stroke-width": NOTE_STROKE_WIDTH,
    }),
  ];

  const stemUp = yFactor < 0;
  const stemX = stemUp ? xPosition + NOTE_HEAD_RX * 0.85 : xPosition - NOTE_HEAD_RX * 0.85;
  const stemY2 = stemUp ? y - STEM_LENGTH : y + STEM_LENGTH;

  childNodes.push(
    line({
      x1: stemX,
      y1: y,
      x2: stemX,
      y2: stemY2,
      stroke: noteColor,
      "stroke-width": 1.5,
    }),
  );

  if (withLabel) {
    childNodes.push(
      text(
        {
          x: xPosition,
          y: STAFF_MARGIN_TOP + STAFF_LINES_COUNT * LINE_SPACING + 25,
          "font-size": 14,
          "text-anchor": "middle",
          fill: noteColor,
        },
        scientific,
      ),
    );
  }

  return group(childNodes);
}

export function clearStaff(svgElement) {
  svgElement.innerHTML = "";
}

export function drawStaff(svgElement, { clef = "treble", middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING } = {}) {
  clearStaff(svgElement);
  return appendSvgModel(svgElement, SVG_NS, buildLearningStaffModel({ clef, middleLineY }));
}

export function getNoteYPosition(scientific, { clef = "treble", middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING } = {}) {
  const yFactor = getYFactor(scientific, clef);
  if (yFactor === null) {
    return null;
  }

  return middleLineY - yFactor * (LINE_SPACING / 2);
}

export function drawNote(svgElement, {
  scientific,
  xPosition,
  clef = "treble",
  noteColor = NOTE_COLOR_DEFAULT,
  withLabel = false,
  middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING,
}) {
  const noteNode = buildLearningNoteModel({
    scientific,
    xPosition,
    clef,
    noteColor,
    withLabel,
    middleLineY,
  });

  if (!noteNode) {
    return null;
  }

  const [noteElement] = appendSvgModel(svgElement, SVG_NS, [noteNode]);
  return noteElement;
}

export function drawNoteSequence(svgElement, { notes, clef = "treble", noteColor = NOTE_COLOR_DEFAULT } = {}) {
  drawStaff(svgElement, { clef });

  if (!Array.isArray(notes) || notes.length === 0) {
    return [];
  }

  const startX = STAFF_MARGIN_LEFT + 110;
  const availableWidth = SVG_STAFF_WIDTH - startX - STAFF_MARGIN_LEFT;
  const rawStep = notes.length > 1 ? availableWidth / (notes.length - 1) : 0;
  const step = Math.min(rawStep, 180);

  return notes.map((note, index) => {
    const xPosition = startX + index * step;
    const scientific = note.scientific ?? note;
    drawNote(svgElement, { scientific, xPosition, clef, noteColor, withLabel: false });
    return { scientific, xPosition };
  });
}
