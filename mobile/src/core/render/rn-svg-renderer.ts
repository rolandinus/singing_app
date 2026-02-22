import type { ModelNode } from './staff-model';

const MAP = {
  line: 'Line',
  ellipse: 'Ellipse',
  circle: 'Circle',
  path: 'Path',
  text: 'Text',
  g: 'G',
} as const;

function kebabToCamel(input: string): string {
  return input.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export type SvgDescriptor = {
  component: 'Line' | 'Ellipse' | 'Circle' | 'Path' | 'Text' | 'G';
  props: Record<string, string | number>;
  children: Array<SvgDescriptor | string>;
};

function toDescriptor(node: ModelNode): SvgDescriptor {
  const props: Record<string, string | number> = {};
  Object.entries(node.attrs).forEach(([k, v]) => {
    props[kebabToCamel(k)] = v;
  });

  const children: Array<SvgDescriptor | string> = node.children.map(toDescriptor);
  if (node.type === 'text' && typeof node.text === 'string') {
    children.unshift(node.text);
  }

  return {
    component: MAP[node.type],
    props,
    children,
  };
}

export function toReactNativeSvgTree(nodes: ModelNode[]): SvgDescriptor[] {
  return nodes.map(toDescriptor);
}
