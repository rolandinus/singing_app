function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required DOM element: #${id}`);
  }
  return element;
}

export function getDomElements() {
  return {
    staffSvg: getRequiredElement("staffSvg"),
    recordedStaffSvg: getRequiredElement("recordedStaffSvg"),
    messageBox: getRequiredElement("messageBox"),
    detectedNoteDebug: getRequiredElement("detectedNoteDebug"),
    visualMetronomeToggle: getRequiredElement("visualMetronomeToggle"),
    visualMetronomeIndicator: getRequiredElement("visualMetronomeIndicator"),
    bpmInput: getRequiredElement("bpmInput"),
    generateNotesBtn: getRequiredElement("generateNotesBtn"),
    playNotesBtn: getRequiredElement("playNotesBtn"),
    recordBtn: getRequiredElement("recordBtn"),
    stopBtn: getRequiredElement("stopBtn"),
    detectedFrequency: getRequiredElement("detectedFrequency"),
    detectedNoteName: getRequiredElement("detectedNoteName"),
    continuousDetectionBtn: getRequiredElement("continuousDetectionBtn"),
    detectionStatus: getRequiredElement("detectionStatus"),
  };
}
