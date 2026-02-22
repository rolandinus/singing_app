function toDataAttributeKey(key) {
  return `data-${String(key).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

export function createSvgElementFromModel(svgNs, modelNode) {
  const element = document.createElementNS(svgNs, modelNode.type);

  Object.entries(modelNode.attrs ?? {}).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });

  const classNames = modelNode.classNames ?? [];
  if (classNames.length > 0) {
    element.setAttribute("class", classNames.join(" "));
  }

  Object.entries(modelNode.dataset ?? {}).forEach(([key, value]) => {
    element.setAttribute(toDataAttributeKey(key), String(value));
  });

  if (typeof modelNode.text === "string") {
    element.textContent = modelNode.text;
  }

  (modelNode.children ?? []).forEach((child) => {
    element.appendChild(createSvgElementFromModel(svgNs, child));
  });

  return element;
}

export function appendSvgModel(svgElement, svgNs, modelNodes) {
  return modelNodes.map((modelNode) => {
    const element = createSvgElementFromModel(svgNs, modelNode);
    svgElement.appendChild(element);
    return element;
  });
}
