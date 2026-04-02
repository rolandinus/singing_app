function node(type, attrs = {}, options = {}) {
  return {
    type,
    attrs,
    classNames: options.classNames ?? [],
    dataset: options.dataset ?? {},
    text: options.text,
    children: options.children ?? [],
  };
}

export function line(attrs = {}, options = {}) {
  return node("line", attrs, options);
}

export function ellipse(attrs = {}, options = {}) {
  return node("ellipse", attrs, options);
}

export function circle(attrs = {}, options = {}) {
  return node("circle", attrs, options);
}

export function path(attrs = {}, options = {}) {
  return node("path", attrs, options);
}

export function text(attrs = {}, content = "", options = {}) {
  return node("text", attrs, { ...options, text: content });
}

export function group(children = [], attrs = {}, options = {}) {
  return node("g", attrs, { ...options, children });
}
