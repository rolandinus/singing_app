export type ModelNode = {
  type: 'line' | 'ellipse' | 'circle' | 'path' | 'text' | 'g';
  attrs: Record<string, string | number>;
  classNames: string[];
  dataset: Record<string, string | number>;
  text?: string;
  children: ModelNode[];
};

function node(type: ModelNode['type'], attrs: Record<string, string | number> = {}, options: Partial<Omit<ModelNode, 'type' | 'attrs'>> = {}): ModelNode {
  return {
    type,
    attrs,
    classNames: options.classNames ?? [],
    dataset: options.dataset ?? {},
    text: options.text,
    children: options.children ?? [],
  };
}

export function line(attrs: Record<string, string | number>): ModelNode { return node('line', attrs); }
export function ellipse(attrs: Record<string, string | number>): ModelNode { return node('ellipse', attrs); }
export function text(attrs: Record<string, string | number>, content: string): ModelNode { return node('text', attrs, { text: content }); }
export function group(children: ModelNode[]): ModelNode { return node('g', {}, { children }); }
