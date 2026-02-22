import { LINE_SPACING, STAFF_LINES_COUNT, STAFF_MARGIN_LEFT, STAFF_MARGIN_TOP, SVG_STAFF_WIDTH } from '../config/constants';
import { ellipse, line, text } from './staff-model';

function yForScientific(scientific: string, clef: 'treble' | 'bass'): number {
  const anchor = clef === 'bass' ? 'D3' : 'B4';
  const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const parse = (value: string) => {
    const m = /^([A-G])([#b]?)(\d)$/.exec(value);
    if (!m) return null;
    const letter = m[1];
    const octave = Number(m[3]);
    return octave * 7 + order.indexOf(letter);
  };

  const a = parse(anchor);
  const b = parse(scientific);
  if (a === null || b === null) return STAFF_MARGIN_TOP + 2 * LINE_SPACING;

  const yFactor = b - a;
  const middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING;
  return middleLineY - yFactor * (LINE_SPACING / 2);
}

export function buildStaffNodes(clef: 'treble' | 'bass') {
  const nodes = [];
  for (let i = 0; i < STAFF_LINES_COUNT; i += 1) {
    const y = STAFF_MARGIN_TOP + i * LINE_SPACING;
    nodes.push(line({ x1: STAFF_MARGIN_LEFT, y1: y, x2: SVG_STAFF_WIDTH - STAFF_MARGIN_LEFT, y2: y, stroke: '#0f172a', 'stroke-width': 1 }));
  }
  nodes.push(text({ x: STAFF_MARGIN_LEFT + 24, y: clef === 'bass' ? 78 : 93, 'font-size': clef === 'bass' ? 56 : 64, fill: '#0f172a' }, clef === 'bass' ? '𝄢' : '𝄞'));
  return nodes;
}

export function buildNoteNodes(notes: string[], clef: 'treble' | 'bass') {
  if (!notes.length) return [];
  const startX = STAFF_MARGIN_LEFT + 110;
  const availableWidth = SVG_STAFF_WIDTH - startX - STAFF_MARGIN_LEFT;
  const step = notes.length > 1 ? Math.min(availableWidth / (notes.length - 1), 180) : 0;

  return notes.map((scientific, index) => {
    const x = startX + index * step;
    const y = yForScientific(scientific, clef);
    return ellipse({ cx: x, cy: y, rx: 6.5, ry: 5, fill: '#0f172a', stroke: '#0f172a', 'stroke-width': 1.5 });
  });
}
