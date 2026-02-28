const RN_COMPONENT_BY_TYPE = {
  line: "Line",
  ellipse: "Ellipse",
  circle: "Circle",
  path: "Path",
  text: "Text",
  g: "G",
};

function kebabToCamel(input) {
  return String(input).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function normalizePropKey(key) {
  if (key === "class") {
    return "className";
  }

  if (key.startsWith("data-")) {
    return kebabToCamel(key);
  }

  return kebabToCamel(key);
}

function normalizeProps(attrs = {}, classNames = [], dataset = {}) {
  const props = {};

  Object.entries(attrs).forEach(([key, value]) => {
    props[normalizePropKey(key)] = value;
  });

  if (classNames.length > 0) {
    props.className = classNames.join(" ");
  }

  Object.entries(dataset).forEach(([key, value]) => {
    props[kebabToCamel(`data-${key}`)] = value;
  });

  return props;
}

function toReactNodeModel(modelNode) {
  const component = RN_COMPONENT_BY_TYPE[modelNode.type];
  if (!component) {
    throw new Error(`Unsupported SVG node type for React Native: ${modelNode.type}`);
  }

  const props = normalizeProps(modelNode.attrs, modelNode.classNames, modelNode.dataset);
  const children = (modelNode.children ?? []).map(toReactNodeModel);

  if (modelNode.type === "text" && typeof modelNode.text === "string") {
    if (children.length > 0) {
      children.unshift(modelNode.text);
    } else {
      children.push(modelNode.text);
    }
  }

  return {
    component,
    props,
    children,
  };
}

export function toReactNativeSvgTree(modelNodes) {
  if (!Array.isArray(modelNodes)) {
    throw new Error("toReactNativeSvgTree expects an array of model nodes");
  }

  return modelNodes.map(toReactNodeModel);
}

export function getReactNativeSvgTypeMap() {
  return { ...RN_COMPONENT_BY_TYPE };
}

/**
 * Optional helper for users who want to render from descriptors manually.
 *
 * Example usage in RN (pseudo):
 *   const tree = toReactNativeSvgTree(buildLearningStaffModel({ clef: 'treble' }));
 *   tree.map((node, i) => renderNode(node, i));
 */
export function createReactNativeSvgRenderer(components) {
  const componentMap = {
    Line: components.Line,
    Ellipse: components.Ellipse,
    Circle: components.Circle,
    Path: components.Path,
    Text: components.Text,
    G: components.G,
  };

  function renderNode(node, key) {
    const Component = componentMap[node.component];
    if (!Component) {
      throw new Error(`Missing RN SVG component mapping for ${node.component}`);
    }

    const renderedChildren = (node.children ?? []).map((child, index) => {
      if (typeof child === "string") {
        return child;
      }
      return renderNode(child, `${key}-${index}`);
    });

    return {
      Component,
      key,
      props: node.props,
      children: renderedChildren,
    };
  }

  return {
    renderTree(modelNodes) {
      return toReactNativeSvgTree(modelNodes).map((node, index) => renderNode(node, String(index)));
    },
  };
}
