import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { SVG_STAFF_HEIGHT, SVG_STAFF_WIDTH } from '../../core/config/constants';
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

export function StaffSvg({ clef = 'treble', notes = [] }: { clef?: 'treble' | 'bass'; notes?: string[] }) {
  const nodes = [...buildStaffNodes(clef), ...buildNoteNodes(notes, clef)];
  const tree = toReactNativeSvgTree(nodes);

  return (
    <Svg width="100%" height={160} viewBox={`0 0 ${SVG_STAFF_WIDTH} ${SVG_STAFF_HEIGHT}`}>
      {tree.map((node, index) => renderNode(node, String(index)))}
    </Svg>
  );
}
