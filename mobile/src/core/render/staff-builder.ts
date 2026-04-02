import { LINE_SPACING, STAFF_LINES_COUNT, STAFF_MARGIN_LEFT, STAFF_MARGIN_TOP, SVG_STAFF_WIDTH } from '../config/constants';
import type { NoteType } from '../types';
import { ellipse, group, line, text } from './staff-model';
import type { ModelNode } from './staff-model';

type NoteRenderStyle = {
  fill?: string;
  stroke?: string;
  rx?: number;
  ry?: number;
};

type NoteRenderOptions = {
  noteStyles?: Array<NoteRenderStyle | null | undefined>;
  slotIndices?: number[];
  layoutNoteCount?: number;
};

function yForScientific(scientific: string, clef: 'treble' | 'bass'): number {
  const anchor = clef === 'bass' ? 'D3' : 'B4';
  const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const parse = (value: string) => {
    const m = /^([A-G])([#b]?)(\d)$/.exec(value);
    if (!m) return null;
    return Number(m[3]) * 7 + order.indexOf(m[1]);
  };

  const a = parse(anchor);
  const b = parse(scientific);
  const middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING;
  if (a === null || b === null) return middleLineY;

  return middleLineY - (b - a) * (LINE_SPACING / 2);
}

export function buildStaffNodes(clef: 'treble' | 'bass', color: string = '#0f172a') {
  const nodes = [];
  for (let i = 0; i < STAFF_LINES_COUNT; i += 1) {
    const y = STAFF_MARGIN_TOP + i * LINE_SPACING;
    nodes.push(line({ x1: STAFF_MARGIN_LEFT, y1: y, x2: SVG_STAFF_WIDTH - STAFF_MARGIN_LEFT, y2: y, stroke: color, 'stroke-width': 1 }));
  }
  nodes.push(text({ x: STAFF_MARGIN_LEFT + 24, y: clef === 'bass' ? 78 : 93, 'font-size': clef === 'bass' ? 56 : 64, fill: color }, clef === 'bass' ? '𝄢' : '𝄞'));
  return nodes;
}

/**
 * Build note nodes for rendering on the staff.
 * Quarter notes are rendered as filled ellipses.
 * Half notes are rendered as hollow ellipses with an upward stem.
 *
 * @param notes - Array of scientific pitch names (e.g. 'C4', 'G5').
 * @param clef - Clef used to compute vertical position.
 * @param highlightIndex - Index of the note to highlight (e.g. during capture).
 * @param durations - Optional per-note durations; defaults to 'quarter' for all notes.
 */
export function buildNoteNodes(
  notes: string[],
  clef: 'treble' | 'bass',
  highlightIndex: number | null = null,
  durations?: NoteType[],
  options?: NoteRenderOptions,
  defaultColor: string = '#0f172a',
): ModelNode[] {
  if (!notes.length) return [];
  const startX = STAFF_MARGIN_LEFT + 110;
  const availableWidth = SVG_STAFF_WIDTH - startX - STAFF_MARGIN_LEFT;
  const layoutNoteCount = options?.layoutNoteCount ?? notes.length;
  const step = layoutNoteCount > 1 ? Math.min(availableWidth / (layoutNoteCount - 1), 180) : 0;
  const stemHeight = LINE_SPACING * 3;

  return notes.map((scientific, index) => {
    const slotIndex = options?.slotIndices?.[index] ?? index;
    const x = startX + slotIndex * step;
    const y = yForScientific(scientific, clef);
    const isHighlighted = highlightIndex !== null && index === highlightIndex;
    const isHalf = (durations?.[index] ?? 'quarter') === 'half';
    const style = options?.noteStyles?.[index];

    const fillColor = style?.fill ?? (isHighlighted ? '#2563eb' : defaultColor);
    const strokeColor = style?.stroke ?? (isHighlighted ? '#2563eb' : defaultColor);
    const rx = style?.rx ?? (isHighlighted ? 8 : 6.5);
    const ry = style?.ry ?? (isHighlighted ? 6 : 5);

    if (isHalf) {
      const notehead = ellipse({ cx: x, cy: y, rx, ry, fill: 'transparent', stroke: strokeColor, 'stroke-width': 1.5 });
      const stem = line({ x1: x + rx, y1: y, x2: x + rx, y2: y - stemHeight, stroke: strokeColor, 'stroke-width': 1.5 });
      return group([notehead, stem]);
    }

    return ellipse({ cx: x, cy: y, rx, ry, fill: fillColor, stroke: strokeColor, 'stroke-width': 1.5 });
  });
}
