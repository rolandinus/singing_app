import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  LINE_SPACING,
  STAFF_MARGIN_LEFT,
  STAFF_MARGIN_TOP,
  SVG_STAFF_HEIGHT,
  SVG_STAFF_WIDTH,
} from '../../core/config/constants';
import { buildNoteNodes, buildStaffNodes } from '../../core/render/staff-builder';
import { toReactNativeSvgTree, type SvgDescriptor } from '../../core/render/rn-svg-renderer';

const componentMap = {
  Line,
  Ellipse,
  Circle,
  Path,
  Text: SvgText,
  G,
} as const;

function renderNode(node: SvgDescriptor, key: string): React.ReactNode {
  const Component = componentMap[node.component];
  const children = node.children.map((child, index) => {
    if (typeof child === 'string') return child;
    return renderNode(child, `${key}-${index}`);
  });
  return <Component key={key} {...node.props}>{children}</Component>;
}

function yForScientific(scientific: string, clef: 'treble' | 'bass'): number {
  const anchor = clef === 'bass' ? 'D3' : 'B4';
  const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const parse = (value: string) => {
    const match = /^([A-G])([#b]?)(\d)$/.exec(value);
    if (!match) return null;
    const letter = match[1];
    const octave = Number(match[3]);
    return octave * 7 + order.indexOf(letter);
  };

  const anchorValue = parse(anchor);
  const noteValue = parse(scientific);
  if (anchorValue === null || noteValue === null) return STAFF_MARGIN_TOP + 2 * LINE_SPACING;

  const yFactor = noteValue - anchorValue;
  const middleLineY = STAFF_MARGIN_TOP + 2 * LINE_SPACING;
  return middleLineY - yFactor * (LINE_SPACING / 2);
}

function xForSlot(slotIndex: number, layoutNoteCount: number): number {
  const startX = STAFF_MARGIN_LEFT + 110;
  const availableWidth = SVG_STAFF_WIDTH - startX - STAFF_MARGIN_LEFT;
  const step = layoutNoteCount > 1 ? Math.min(availableWidth / (layoutNoteCount - 1), 180) : 0;
  return startX + slotIndex * step;
}

export function StaffSvg({
  clef = 'treble',
  notes = [],
  highlightIndex,
  overlayNote,
  overlayIndex,
  overlayDuration,
  overlayDirection,
  singleNoteLayout,
}: {
  clef?: 'treble' | 'bass';
  notes?: string[];
  highlightIndex?: number | null;
  overlayNote?: string | null;
  overlayIndex?: number | null;
  overlayDuration?: 'quarter' | 'half';
  overlayDirection?: 'up' | 'down' | null;
  singleNoteLayout?: boolean;
}) {
  const promptNoteOptions = singleNoteLayout && notes.length === 1
    ? { noteStyles: [{ rx: 10, ry: 8 }] }
    : undefined;
  const noteNodes = buildNoteNodes(notes, clef, highlightIndex ?? null, undefined, promptNoteOptions);
  const overlayLayoutCount = overlayIndex != null ? Math.max(notes.length, overlayIndex + 1) : notes.length;
  const overlayNodes = overlayNote && overlayIndex != null
    ? buildNoteNodes(
      [overlayNote],
      clef,
      null,
      [overlayDuration ?? 'quarter'],
      {
        layoutNoteCount: overlayLayoutCount,
        slotIndices: [overlayIndex],
        noteStyles: [{
          fill: '#dc2626',
          stroke: '#dc2626',
          rx: singleNoteLayout ? 10 : 8,
          ry: singleNoteLayout ? 8 : 6,
        }],
      },
    )
    : [];
  const nodes = [...buildStaffNodes(clef), ...noteNodes, ...overlayNodes];
  const tree = toReactNativeSvgTree(nodes);
  const arrowX = overlayNote && overlayIndex != null ? xForSlot(overlayIndex, overlayLayoutCount) : null;
  const arrowY = overlayNote && overlayIndex != null ? yForScientific(overlayNote, clef) : null;
  const directionArrow = overlayDirection === 'up' ? '↑' : overlayDirection === 'down' ? '↓' : null;
  const svgHeight = singleNoteLayout ? 132 : 160;

  return (
    <Svg width="100%" height={svgHeight} viewBox={`0 0 ${SVG_STAFF_WIDTH} ${SVG_STAFF_HEIGHT}`}>
      {tree.map((node, index) => renderNode(node, String(index)))}
      {directionArrow && arrowX != null && arrowY != null ? (
        <SvgText
          x={arrowX}
          y={overlayDirection === 'up' ? arrowY - 18 : arrowY + 24}
          fill="#dc2626"
          fontSize={18}
          fontWeight="700"
          textAnchor="middle"
        >
          {directionArrow}
        </SvgText>
      ) : null}
    </Svg>
  );
}
