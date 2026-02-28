import React from "react";
import * as RNSvg from "react-native-svg";
import { SVG_STAFF_HEIGHT, SVG_STAFF_WIDTH, STAFF_MARGIN_LEFT } from "../../config/constants.js";
import { buildLearningNoteModel, buildLearningStaffModel } from "../learning-staff.js";
import { toReactNativeSvgTree } from "../rn-svg-renderer.js";

const COMPONENT_MAP = {
  Line: RNSvg.Line,
  Ellipse: RNSvg.Ellipse,
  Circle: RNSvg.Circle,
  Path: RNSvg.Path,
  Text: RNSvg.Text,
  G: RNSvg.G,
};

function renderNode(node, key) {
  const Component = COMPONENT_MAP[node.component];
  if (!Component) {
    return null;
  }

  const children = (node.children ?? []).map((child, index) => {
    if (typeof child === "string") {
      return child;
    }

    return renderNode(child, `${key}-${index}`);
  });

  return React.createElement(Component, { key, ...node.props }, ...children);
}

function buildSceneNodes({ clef, notes, showLabels }) {
  const staffNodes = buildLearningStaffModel({ clef });
  if (!Array.isArray(notes) || notes.length === 0) {
    return staffNodes;
  }

  const startX = STAFF_MARGIN_LEFT + 110;
  const availableWidth = SVG_STAFF_WIDTH - startX - STAFF_MARGIN_LEFT;
  const step = notes.length > 1 ? Math.min(availableWidth / (notes.length - 1), 180) : 0;

  const noteNodes = notes
    .map((scientific, index) => buildLearningNoteModel({
      scientific,
      xPosition: startX + index * step,
      clef,
      withLabel: Boolean(showLabels),
    }))
    .filter(Boolean);

  return [...staffNodes, ...noteNodes];
}

/**
 * React Native example component for rendering the shared staff model.
 *
 * Example:
 * <StaffSvgView clef="treble" notes={["C4", "E4", "G4"]} />
 */
export function StaffSvgView({
  clef = "treble",
  notes = [],
  showLabels = false,
  width = SVG_STAFF_WIDTH,
  height = SVG_STAFF_HEIGHT,
}) {
  const modelNodes = buildSceneNodes({ clef, notes, showLabels });
  const descriptorTree = toReactNativeSvgTree(modelNodes);

  return React.createElement(
    RNSvg.Svg,
    {
      width,
      height,
      viewBox: `0 0 ${SVG_STAFF_WIDTH} ${SVG_STAFF_HEIGHT}`,
    },
    ...descriptorTree.map((node, index) => renderNode(node, String(index))),
  );
}

