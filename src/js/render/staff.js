import {
  ACCIDENTAL_OFFSET_X,
  LINE_COLOR,
  LINE_SPACING,
  MIDDLE_LINE_D3_Y_GENERATED,
  NOTE_COLOR_DEFAULT,
  NOTE_HEAD_RX,
  NOTE_HEAD_RY,
  NOTE_HIGHLIGHT_COLOR,
  NOTE_PROPERTIES,
  NOTE_STROKE_WIDTH,
  NOTE_STRINGS,
  SOLFEGE_MAP,
  STAFF_LINES_COUNT,
  STAFF_MARGIN_LEFT,
  STAFF_MARGIN_TOP,
  STEM_LENGTH,
  SVG_NS,
  SVG_STAFF_WIDTH,
} from "../config/constants.js";

export function createSvgElement(type, attributes = {}) {
  const element = document.createElementNS(SVG_NS, type);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

export function drawStaffOnSvg(svgElement, middleLineY = MIDDLE_LINE_D3_Y_GENERATED) {
  svgElement.innerHTML = "";

  for (let i = 0; i < STAFF_LINES_COUNT; i += 1) {
    const y = STAFF_MARGIN_TOP + i * LINE_SPACING;
    svgElement.appendChild(
      createSvgElement("line", {
        x1: STAFF_MARGIN_LEFT,
        y1: y,
        x2: SVG_STAFF_WIDTH - STAFF_MARGIN_LEFT,
        y2: y,
        stroke: LINE_COLOR,
        "stroke-width": "1",
      }),
    );
  }

  const clefX = STAFF_MARGIN_LEFT + 25;
  const yF3Line = middleLineY - NOTE_PROPERTIES.F3.yFactor * (LINE_SPACING / 2);

  const clefPath = createSvgElement("path", {
    d: `M ${clefX - 5} ${yF3Line - LINE_SPACING * 1.8} a ${LINE_SPACING * 1.2} ${LINE_SPACING * 1.2} 0 0 0 0 ${LINE_SPACING * 3.6} c ${LINE_SPACING * 0.8} ${LINE_SPACING * 0.5} ${LINE_SPACING * 1.5} ${-LINE_SPACING * 0.5} ${LINE_SPACING * 1.5} ${-LINE_SPACING * 1.5} S ${clefX} ${yF3Line - LINE_SPACING * 1.5} ${clefX - 5} ${yF3Line - LINE_SPACING * 1.8}`,
    fill: "none",
    stroke: NOTE_COLOR_DEFAULT,
    "stroke-width": "2.5",
  });

  svgElement.appendChild(clefPath);

  const dotRadius = LINE_SPACING * 0.2;
  const yG3Space = middleLineY - NOTE_PROPERTIES.G3.yFactor * (LINE_SPACING / 2);
  const yE3Space = middleLineY - NOTE_PROPERTIES.E3.yFactor * (LINE_SPACING / 2);

  svgElement.appendChild(
    createSvgElement("circle", {
      cx: clefX + LINE_SPACING * 1.1,
      cy: yG3Space,
      r: dotRadius,
      fill: NOTE_COLOR_DEFAULT,
    }),
  );

  svgElement.appendChild(
    createSvgElement("circle", {
      cx: clefX + LINE_SPACING * 1.1,
      cy: yE3Space,
      r: dotRadius,
      fill: NOTE_COLOR_DEFAULT,
    }),
  );
}

function getNoteDrawingParams(scientificNoteName) {
  const noteMatch = /^([A-G])([#b]?)(\d)$/.exec(scientificNoteName);
  if (!noteMatch) {
    console.error(`Invalid note format: ${scientificNoteName}`);
    return null;
  }

  const [, baseNoteName, accidental, octaveRaw] = noteMatch;
  const octave = Number.parseInt(octaveRaw, 10);
  const diatonicBaseKey = `${baseNoteName}${octave}`;

  let noteInfo = NOTE_PROPERTIES[diatonicBaseKey];

  if (!noteInfo) {
    const notePart = `${baseNoteName}${accidental}`;
    const noteIndex = NOTE_STRINGS.indexOf(notePart);
    const tempMidi = noteIndex !== -1 ? noteIndex + (octave + 1) * 12 : -1;

    if (tempMidi === -1 || Number.isNaN(tempMidi)) {
      console.error(`Could not compute MIDI for: ${scientificNoteName}`);
      return null;
    }

    let closestDiatonicKey = null;
    let minDiff = Number.POSITIVE_INFINITY;

    Object.keys(NOTE_PROPERTIES).forEach((key) => {
      const diff = Math.abs(NOTE_PROPERTIES[key].midi - tempMidi);
      if (diff < minDiff) {
        minDiff = diff;
        closestDiatonicKey = key;
      } else if (diff === minDiff && NOTE_PROPERTIES[key].scientific.startsWith(baseNoteName)) {
        closestDiatonicKey = key;
      }
    });

    if (!closestDiatonicKey) {
      console.error(`Fallback lookup failed for: ${scientificNoteName}`);
      return null;
    }

    noteInfo = NOTE_PROPERTIES[closestDiatonicKey];
  }

  return {
    yFactor: noteInfo.yFactor,
    accidental,
  };
}

function drawLedgerLinesOnSvg(svgElement, middleLineY, cx, yFactor) {
  const ledgerWidth = NOTE_HEAD_RX * 2.5;
  const x1 = cx - ledgerWidth / 2;
  const x2 = cx + ledgerWidth / 2;
  const step = LINE_SPACING / 2;

  if (yFactor <= -8) {
    svgElement.appendChild(
      createSvgElement("line", {
        x1,
        y1: middleLineY + 8 * step,
        x2,
        y2: middleLineY + 8 * step,
        stroke: LINE_COLOR,
        "stroke-width": "1",
      }),
    );

    svgElement.appendChild(
      createSvgElement("line", {
        x1,
        y1: middleLineY + 6 * step,
        x2,
        y2: middleLineY + 6 * step,
        stroke: LINE_COLOR,
        "stroke-width": "1",
      }),
    );

    if (yFactor <= -10) {
      svgElement.appendChild(
        createSvgElement("line", {
          x1,
          y1: middleLineY + 10 * step,
          x2,
          y2: middleLineY + 10 * step,
          stroke: LINE_COLOR,
          "stroke-width": "1",
        }),
      );
    }
  } else if (yFactor === -7 || yFactor === -6) {
    svgElement.appendChild(
      createSvgElement("line", {
        x1,
        y1: middleLineY + 6 * step,
        x2,
        y2: middleLineY + 6 * step,
        stroke: LINE_COLOR,
        "stroke-width": "1",
      }),
    );
  }

  if (yFactor >= 6) {
    svgElement.appendChild(
      createSvgElement("line", {
        x1,
        y1: middleLineY - 6 * step,
        x2,
        y2: middleLineY - 6 * step,
        stroke: LINE_COLOR,
        "stroke-width": "1",
      }),
    );

    if (yFactor >= 8) {
      svgElement.appendChild(
        createSvgElement("line", {
          x1,
          y1: middleLineY - 8 * step,
          x2,
          y2: middleLineY - 8 * step,
          stroke: LINE_COLOR,
          "stroke-width": "1",
        }),
      );
    }

    if (yFactor >= 10) {
      svgElement.appendChild(
        createSvgElement("line", {
          x1,
          y1: middleLineY - 10 * step,
          x2,
          y2: middleLineY - 10 * step,
          stroke: LINE_COLOR,
          "stroke-width": "1",
        }),
      );
    }
  }
}

export function drawNoteOnSvg({
  svgElement,
  middleLineY,
  noteData,
  xPosition,
  noteColor = NOTE_COLOR_DEFAULT,
  isClickable = false,
  noteIndex = null,
}) {
  const drawingParams = getNoteDrawingParams(noteData.scientific);
  if (!drawingParams) {
    return null;
  }

  const { yFactor, accidental } = drawingParams;
  const cy = middleLineY - yFactor * (LINE_SPACING / 2);
  drawLedgerLinesOnSvg(svgElement, middleLineY, xPosition, yFactor);

  const noteGroup = createSvgElement("g");

  if (isClickable) {
    noteGroup.classList.add("clickable-note");
    noteGroup.setAttribute("data-note-scientific", noteData.scientific);
    noteGroup.setAttribute("data-note-duration", noteData.duration);

    if (noteIndex !== null) {
      noteGroup.setAttribute("data-note-index", String(noteIndex));
    }
  }

  const isHalfNote = noteData.duration === "2n" && noteColor === NOTE_COLOR_DEFAULT;
  const noteHead = createSvgElement("ellipse", {
    cx: xPosition,
    cy,
    rx: NOTE_HEAD_RX,
    ry: NOTE_HEAD_RY,
    fill: isHalfNote ? "white" : noteColor,
    stroke: noteColor,
    "stroke-width": NOTE_STROKE_WIDTH,
  });

  noteGroup.appendChild(noteHead);

  if (accidental) {
    const accidentalSymbol = accidental === "#" ? "♯" : accidental === "b" ? "♭" : "";

    const accidentalText = createSvgElement("text", {
      x: xPosition + ACCIDENTAL_OFFSET_X,
      y: cy + NOTE_HEAD_RY / 2,
      "font-size": `${LINE_SPACING * 1.5}px`,
      fill: noteColor,
      "font-family": "Arial Unicode MS, Lucida Sans Unicode, DejaVu Sans, sans-serif",
    });

    accidentalText.textContent = accidentalSymbol;
    noteGroup.appendChild(accidentalText);
  }

  let stemX = xPosition;
  const stemY1 = cy;
  let stemY2;

  if (yFactor < 0) {
    stemX = xPosition + NOTE_HEAD_RX * 0.85;
    stemY2 = cy - STEM_LENGTH;
  } else {
    stemX = xPosition - NOTE_HEAD_RX * 0.85;
    stemY2 = cy + STEM_LENGTH;
  }

  noteGroup.appendChild(
    createSvgElement("line", {
      x1: stemX,
      y1: stemY1,
      x2: stemX,
      y2: stemY2,
      stroke: noteColor,
      "stroke-width": "1.5",
    }),
  );

  const noteLetter = noteData.scientific.slice(0, 1);
  const solfegeLabel = SOLFEGE_MAP[noteLetter] || "";

  if (solfegeLabel) {
    const labelText = createSvgElement("text", {
      x: xPosition,
      y: STAFF_MARGIN_TOP + STAFF_LINES_COUNT * LINE_SPACING + 25,
      "font-size": "14px",
      "font-weight": "500",
      fill: noteColor,
      "text-anchor": "middle",
    });

    labelText.textContent = solfegeLabel;
    noteGroup.appendChild(labelText);
  }

  svgElement.appendChild(noteGroup);
  return noteGroup;
}

export function highlightCurrentNote(noteElementsArray, index) {
  noteElementsArray.forEach((noteElement) => {
    if (!noteElement) {
      return;
    }

    noteElement.classList.remove("current-singing-note");
    const ellipse = noteElement.querySelector("ellipse");

    if (!ellipse) {
      return;
    }

    const isHalfNote = ellipse.getAttribute("fill") === "white";
    ellipse.setAttribute("fill", isHalfNote ? "white" : NOTE_COLOR_DEFAULT);
    ellipse.setAttribute("stroke", NOTE_COLOR_DEFAULT);
  });

  if (index < 0 || index >= noteElementsArray.length || !noteElementsArray[index]) {
    return;
  }

  const current = noteElementsArray[index];
  current.classList.add("current-singing-note");

  const ellipse = current.querySelector("ellipse");
  if (!ellipse) {
    return;
  }

  const isHalfNote = ellipse.getAttribute("fill") === "white";
  ellipse.setAttribute("stroke", NOTE_HIGHLIGHT_COLOR);

  if (!isHalfNote) {
    ellipse.setAttribute("fill", NOTE_HIGHLIGHT_COLOR);
  }
}
