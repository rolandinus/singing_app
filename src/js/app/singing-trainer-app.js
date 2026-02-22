import {
  AVAILABLE_NOTES_SORTED,
  LINE_SPACING,
  MIDDLE_LINE_D3_Y_GENERATED,
  MIDDLE_LINE_D3_Y_RECORDED,
  NOTE_COLOR_DEFAULT,
  NOTE_COLOR_WRONG,
  NOTE_PROPERTIES,
  NOTE_STRINGS,
  STAFF_LINES_COUNT,
  STAFF_MARGIN_LEFT,
  STAFF_MARGIN_TOP,
  SVG_STAFF_WIDTH,
} from "../config/constants.js";
import { autoCorrelate, midiToNoteName, noteFromPitch } from "../utils/pitch.js";
import {
  createSvgElement,
  drawNoteOnSvg,
  drawStaffOnSvg,
  getNoteYPosition,
  highlightCurrentNote,
} from "../render/staff.js";

export class SingingTrainerApp {
  constructor(dom, options = {}) {
    this.dom = dom;
    this.options = options;
    this.tone = window.Tone ?? null;

    this.generatedNotes = [];
    this.recordedNotesDisplay = [];
    this.noteElementsArray = [];

    this.melodySynth = null;
    this.clickSynth = null;

    this.audioContext = null;
    this.analyser = null;
    this.microphoneSourceNode = null;

    this.pitchDetectionIntervalId = null;
    this.visualMetronomeIntervalId = null;
    this.continuousDetectionIntervalId = null;
    this.animationFrameId = null;

    this.isRecording = false;
    this.currentRecordingSlot = 0;
    this.detectedPitchesInSlot = [];

    this.playbackLine = null;
    this.liveFeedbackMarker = null;

    this.isContinuousDetectionActive = false;
  }

  init() {
    this.initToneSynths();
    this.bindEventListeners();

    drawStaffOnSvg(this.dom.staffSvg, MIDDLE_LINE_D3_Y_GENERATED);
    drawStaffOnSvg(this.dom.recordedStaffSvg, MIDDLE_LINE_D3_Y_RECORDED);

    this.generateAndDisplayNotes();
    this.dom.messageBox.textContent = "Bereit. Generieren Sie eine Melodie oder starten Sie direkt.";
  }

  initToneSynths() {
    if (!this.tone) {
      this.dom.messageBox.textContent = "Fehler: Tone.js nicht gefunden.";
      return;
    }

    try {
      this.melodySynth = new this.tone.Synth().toDestination();
      this.clickSynth = new this.tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        envelope: {
          attack: 0.001,
          decay: 0.3,
          sustain: 0,
          release: 0.1,
        },
      }).toDestination();

      this.clickSynth.volume.value = -10;
    } catch (error) {
      console.error("Tone.js initialization failed:", error);
      this.dom.messageBox.textContent = "Fehler: Audio-Engine.";
    }
  }

  bindEventListeners() {
    this.dom.bpmInput.addEventListener("change", () => {
      this.sanitizeBpmInput();
    });

    this.dom.generateNotesBtn.addEventListener("click", () => {
      this.generateAndDisplayNotes();
    });

    this.dom.playNotesBtn.addEventListener("click", () => {
      this.playMelodyOnly(false);
    });

    this.dom.recordBtn.addEventListener("click", () => {
      this.startRecordingProcess();
    });

    this.dom.stopBtn.addEventListener("click", () => {
      this.stopAllAudioAndRecording();
    });

    this.dom.staffSvg.addEventListener("click", (event) => {
      this.playClickedNote(event);
    });

    this.dom.continuousDetectionBtn.addEventListener("click", () => {
      this.toggleContinuousDetection();
    });

    this.dom.liveFeedbackToggle.addEventListener("change", () => {
      if (!this.dom.liveFeedbackToggle.checked) {
        this.clearLiveFeedbackMarker();
      }
    });
  }

  sanitizeBpmInput() {
    const minBpm = 40;
    const maxBpm = 240;

    let value = Number.parseInt(this.dom.bpmInput.value, 10);

    if (Number.isNaN(value)) {
      value = 90;
    }

    value = Math.max(minBpm, Math.min(maxBpm, value));
    this.dom.bpmInput.value = String(value);

    return value;
  }

  getQuarterNoteDurationFromBpm() {
    const bpm = this.sanitizeBpmInput();
    return 60 / bpm;
  }

  removePlaybackLine() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.playbackLine) {
      this.playbackLine.remove();
      this.playbackLine = null;
    }
  }

  clearLiveFeedbackMarker() {
    if (!this.liveFeedbackMarker) {
      return;
    }

    this.liveFeedbackMarker.remove();
    this.liveFeedbackMarker = null;
  }

  updateLiveFeedbackMarker(midiNote) {
    if (!this.isRecording || !this.dom.liveFeedbackToggle.checked) {
      this.clearLiveFeedbackMarker();
      return;
    }

    const targetNote = this.generatedNotes[this.currentRecordingSlot];
    if (!targetNote) {
      this.clearLiveFeedbackMarker();
      return;
    }

    const targetMidi = NOTE_PROPERTIES[targetNote.scientific]?.midi;
    if (targetMidi === undefined || targetMidi === midiNote) {
      this.clearLiveFeedbackMarker();
      return;
    }

    const sungNoteScientific = midiToNoteName(midiNote, NOTE_STRINGS);
    if (!sungNoteScientific) {
      this.clearLiveFeedbackMarker();
      return;
    }

    const yPosition = getNoteYPosition(sungNoteScientific, MIDDLE_LINE_D3_Y_GENERATED);
    if (yPosition === null || targetNote.xPosition === undefined) {
      this.clearLiveFeedbackMarker();
      return;
    }

    this.clearLiveFeedbackMarker();

    const markerGroup = createSvgElement("g", { "data-live-feedback": "wrong-pitch" });
    const markerX = targetNote.xPosition;
    const markerColor = "#dc2626";

    markerGroup.appendChild(
      createSvgElement("line", {
        x1: markerX - 16,
        y1: yPosition,
        x2: markerX + 16,
        y2: yPosition,
        stroke: markerColor,
        "stroke-width": "2",
        "stroke-dasharray": "4 3",
      }),
    );

    markerGroup.appendChild(
      createSvgElement("ellipse", {
        cx: markerX,
        cy: yPosition,
        rx: 8,
        ry: 6,
        fill: "rgba(220, 38, 38, 0.18)",
        stroke: markerColor,
        "stroke-width": "2",
      }),
    );

    const markerLabel = createSvgElement("text", {
      x: markerX + 18,
      y: yPosition - 8,
      "font-size": "11px",
      "font-weight": "600",
      fill: markerColor,
    });
    markerLabel.textContent = sungNoteScientific;
    markerGroup.appendChild(markerLabel);

    this.dom.staffSvg.appendChild(markerGroup);
    this.liveFeedbackMarker = markerGroup;
  }

  getSelectedIntervals() {
    return Array.from(document.querySelectorAll('input[name="interval"]:checked'))
      .map((checkbox) => Number.parseInt(checkbox.value, 10))
      .filter((step) => !Number.isNaN(step));
  }

  getSelectedStartNote() {
    const selected = document.querySelector('input[name="startNote"]:checked');
    return selected ? selected.value : "random";
  }

  createRandomDuration(firstNote = false) {
    const chanceForHalfNote = firstNote ? 0.5 : 0.3;
    return Math.random() < chanceForHalfNote ? "2n" : "4n";
  }

  createNextNote(currentNoteScientific, selectedIntervalSteps) {
    const currentNoteIndex = AVAILABLE_NOTES_SORTED.indexOf(currentNoteScientific);

    let nextNoteScientific = null;
    let attempts = 0;

    while (!nextNoteScientific && attempts < 50) {
      const randomInterval = selectedIntervalSteps[Math.floor(Math.random() * selectedIntervalSteps.length)];
      const direction = Math.random() < 0.5 ? 1 : -1;

      let nextIndex = currentNoteIndex + randomInterval * direction;

      if (nextIndex < 0 || nextIndex >= AVAILABLE_NOTES_SORTED.length) {
        nextIndex = currentNoteIndex - randomInterval * direction;
      }

      if (nextIndex >= 0 && nextIndex < AVAILABLE_NOTES_SORTED.length) {
        nextNoteScientific = AVAILABLE_NOTES_SORTED[nextIndex];
      }

      attempts += 1;
    }

    if (!nextNoteScientific) {
      return AVAILABLE_NOTES_SORTED[Math.floor(Math.random() * AVAILABLE_NOTES_SORTED.length)];
    }

    return nextNoteScientific;
  }

  layoutNotesOnStaff() {
    const availableWidth = SVG_STAFF_WIDTH - (STAFF_MARGIN_LEFT + 100) - STAFF_MARGIN_LEFT;
    const totalDurationUnits = this.generatedNotes.reduce(
      (sum, note) => sum + (note.duration === "2n" ? 2 : 1),
      0,
    );

    const widthPerUnit = totalDurationUnits > 0 ? availableWidth / totalDurationUnits : 0;
    let currentX = STAFF_MARGIN_LEFT + 100;

    this.generatedNotes.forEach((note) => {
      const noteWidth = (note.duration === "2n" ? 2 : 1) * widthPerUnit;
      note.xPosition = currentX;
      currentX += noteWidth;
    });
  }

  generateAndDisplayNotes() {
    this.stopAllAudioAndRecording();
    this.dom.messageBox.textContent = "";

    drawStaffOnSvg(this.dom.staffSvg, MIDDLE_LINE_D3_Y_GENERATED);
    drawStaffOnSvg(this.dom.recordedStaffSvg, MIDDLE_LINE_D3_Y_RECORDED);

    this.generatedNotes = [];
    this.recordedNotesDisplay = [];
    this.noteElementsArray = [];
    this.clearLiveFeedbackMarker();

    const selectedIntervals = this.getSelectedIntervals();
    if (selectedIntervals.length === 0) {
      this.dom.messageBox.textContent = "Bitte Intervall(e) auswählen.";
      return;
    }

    const startNoteOption = this.getSelectedStartNote();
    let currentNoteScientific;

    if (startNoteOption === "C2") {
      currentNoteScientific = "C2";
    } else if (startNoteOption === "C4") {
      currentNoteScientific = "C4";
    } else {
      currentNoteScientific = AVAILABLE_NOTES_SORTED[Math.floor(Math.random() * AVAILABLE_NOTES_SORTED.length)];
    }

    if (!AVAILABLE_NOTES_SORTED.includes(currentNoteScientific)) {
      currentNoteScientific = AVAILABLE_NOTES_SORTED[0];
    }

    this.generatedNotes.push({
      scientific: currentNoteScientific,
      duration: this.createRandomDuration(true),
    });

    for (let i = 0; i < 6; i += 1) {
      const nextNote = this.createNextNote(currentNoteScientific, selectedIntervals);

      this.generatedNotes.push({
        scientific: nextNote,
        duration: this.createRandomDuration(false),
      });

      currentNoteScientific = nextNote;
    }

    this.layoutNotesOnStaff();

    this.generatedNotes.forEach((note, index) => {
      const noteElement = drawNoteOnSvg({
        svgElement: this.dom.staffSvg,
        middleLineY: MIDDLE_LINE_D3_Y_GENERATED,
        noteData: note,
        xPosition: note.xPosition,
        noteColor: NOTE_COLOR_DEFAULT,
        isClickable: true,
        noteIndex: index,
      });

      this.noteElementsArray.push(noteElement);
    });

    this.dom.messageBox.textContent = "Neue Melodie generiert.";
  }

  async ensureToneStarted() {
    if (!this.tone) {
      return false;
    }

    if (this.tone.context.state !== "running") {
      await this.tone.start();
    }

    return true;
  }

  scheduleVisualMetronomePulse(timeInSeconds, quarterNoteDuration) {
    if (!this.dom.visualMetronomeToggle.checked || !this.tone) {
      return;
    }

    this.tone.Draw.schedule(() => {
      this.dom.visualMetronomeIndicator.classList.add("active");
    }, timeInSeconds);

    this.tone.Draw.schedule(() => {
      this.dom.visualMetronomeIndicator.classList.remove("active");
    }, timeInSeconds + quarterNoteDuration * 0.5);
  }

  async playMelodyOnly(isCountInOnly = false) {
    if (!isCountInOnly && this.generatedNotes.length === 0) {
      this.dom.messageBox.textContent = "Erst Melodie generieren.";
      return undefined;
    }

    if (!isCountInOnly) {
      this.stopAllAudioAndRecording();
    }

    if (!this.melodySynth || !this.clickSynth || !this.tone) {
      this.dom.messageBox.textContent = "Audio-Engine Fehler.";
      return undefined;
    }

    try {
      await this.ensureToneStarted();

      const now = this.tone.now();
      const quarterNoteDuration = this.getQuarterNoteDurationFromBpm();
      let accumulatedTime = 0;

      this.dom.messageBox.textContent = "Einzähler...";

      for (let i = 0; i < 4; i += 1) {
        const clickTime = now + accumulatedTime;
        this.clickSynth.triggerAttackRelease("C5", "16n", clickTime);
        this.scheduleVisualMetronomePulse(clickTime, quarterNoteDuration);
        accumulatedTime += quarterNoteDuration;
      }

      if (isCountInOnly) {
        setTimeout(() => {
          if (this.dom.visualMetronomeToggle.checked) {
            this.dom.visualMetronomeIndicator.classList.remove("active");
          }
          if (this.dom.messageBox.textContent === "Einzähler...") {
            this.dom.messageBox.textContent = "Bereit für Aufnahme.";
          }
        }, accumulatedTime * 1000 + 100);

        return accumulatedTime;
      }

      const countInEndPlaybackTime = accumulatedTime;
      accumulatedTime += quarterNoteDuration * 0.25;

      this.dom.messageBox.textContent = "Spiele Melodie...";

      this.generatedNotes.forEach((note) => {
        const noteDuration = (note.duration === "2n" ? 2 : 1) * quarterNoteDuration;
        const noteStart = now + accumulatedTime;

        this.melodySynth.triggerAttackRelease(note.scientific, noteDuration, noteStart);

        if (this.dom.visualMetronomeToggle.checked) {
          for (let beat = 0; beat < noteDuration; beat += quarterNoteDuration) {
            const beatTime = noteStart + beat;
            if (beatTime >= now + countInEndPlaybackTime) {
              this.scheduleVisualMetronomePulse(beatTime, quarterNoteDuration);
            }
          }
        }

        accumulatedTime += noteDuration;
      });

      setTimeout(() => {
        if (
          this.dom.messageBox.textContent.startsWith("Spiele") ||
          this.dom.messageBox.textContent.startsWith("Einzähler")
        ) {
          this.dom.messageBox.textContent = "";
        }

        if (this.dom.visualMetronomeToggle.checked) {
          this.dom.visualMetronomeIndicator.classList.remove("active");
        }
      }, accumulatedTime * 1000 + 500);

      return accumulatedTime;
    } catch (error) {
      console.error("Playback failed:", error);
      this.dom.messageBox.textContent = "Abspielfehler.";
      return undefined;
    }
  }

  async initAudioRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Mikrofonzugriff nicht unterstützt.");
      return false;
    }

    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.minDecibels = -100;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.7;
    this.analyser.fftSize = 2048;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.microphoneSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.microphoneSourceNode.connect(this.analyser);
      return true;
    } catch (error) {
      alert("Mikrofonzugriff verweigert.");
      console.error("getUserMedia error:", error);
      return false;
    }
  }

  processAudioSlot() {
    if (!this.isRecording || !this.analyser || !this.audioContext) {
      return;
    }

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    const frequency = autoCorrelate(buffer, this.audioContext.sampleRate);
    if (frequency !== -1) {
      this.detectedPitchesInSlot.push(frequency);
      const liveMidi = noteFromPitch(frequency);
      if (Number.isFinite(liveMidi) && liveMidi >= 0 && liveMidi <= 127) {
        this.updateLiveFeedbackMarker(liveMidi);
      } else {
        this.clearLiveFeedbackMarker();
      }
    } else {
      this.clearLiveFeedbackMarker();
    }
  }

  analyzeAndStoreSlotPitch() {
    if (this.detectedPitchesInSlot.length === 0) {
      this.recordedNotesDisplay.push(null);
      this.dom.detectedNoteDebug.textContent = `Slot ${this.currentRecordingSlot + 1}: Stille`;
      this.clearLiveFeedbackMarker();
      return;
    }

    const midiNotes = this.detectedPitchesInSlot
      .map((frequency) => noteFromPitch(frequency))
      .filter((midi) => midi !== null && midi >= 0 && midi <= 127)
      .sort((a, b) => a - b);

    if (midiNotes.length === 0) {
      this.recordedNotesDisplay.push(null);
      this.dom.detectedNoteDebug.textContent = `Slot ${this.currentRecordingSlot + 1}: Stille`;
      this.detectedPitchesInSlot = [];
      this.clearLiveFeedbackMarker();
      return;
    }

    const medianMidi = midiNotes[Math.floor(midiNotes.length / 2)];
    const sungNoteScientific = midiToNoteName(medianMidi, NOTE_STRINGS);
    const generatedNote = this.generatedNotes[this.currentRecordingSlot];

    if (!sungNoteScientific || !generatedNote) {
      this.recordedNotesDisplay.push(null);
      this.dom.detectedNoteDebug.textContent = `Slot ${this.currentRecordingSlot + 1}: Stille`;
      this.detectedPitchesInSlot = [];
      this.clearLiveFeedbackMarker();
      return;
    }

    const isCorrect = NOTE_PROPERTIES[generatedNote.scientific]?.midi === medianMidi;
    const color = isCorrect ? NOTE_COLOR_DEFAULT : NOTE_COLOR_WRONG;

    this.recordedNotesDisplay.push({
      scientific: sungNoteScientific,
      duration: generatedNote.duration,
      color,
    });

    this.dom.detectedNoteDebug.textContent = `Slot ${this.currentRecordingSlot + 1}: ${sungNoteScientific} (${isCorrect ? "Korrekt" : "Abweichung"})`;
    this.detectedPitchesInSlot = [];
    this.clearLiveFeedbackMarker();
  }

  async startRecordingProcess() {
    if (this.isRecording) {
      return;
    }

    if (this.generatedNotes.length === 0 || !this.generatedNotes[0]?.xPosition) {
      this.dom.messageBox.textContent = "Erst Melodie generieren.";
      return;
    }

    this.stopAllAudioAndRecording();

    const audioReady = await this.initAudioRecording();
    if (!audioReady) {
      return;
    }

    this.isRecording = true;
    this.currentRecordingSlot = 0;
    this.recordedNotesDisplay = [];
    this.detectedPitchesInSlot = [];
    this.clearLiveFeedbackMarker();

    drawStaffOnSvg(this.dom.recordedStaffSvg, MIDDLE_LINE_D3_Y_RECORDED);

    const staffTop = STAFF_MARGIN_TOP - LINE_SPACING;
    const staffBottom = STAFF_MARGIN_TOP + (STAFF_LINES_COUNT - 1) * LINE_SPACING + LINE_SPACING;
    const startX = this.generatedNotes[0].xPosition;

    this.playbackLine = createSvgElement("line", {
      x1: startX,
      y1: staffTop,
      x2: startX,
      y2: staffBottom,
      stroke: "#ef4444",
      "stroke-width": "2.5",
    });

    this.dom.staffSvg.appendChild(this.playbackLine);
    highlightCurrentNote(this.noteElementsArray, 0);

    const countInDuration = await this.playMelodyOnly(true);
    if (typeof countInDuration !== "number") {
      this.isRecording = false;
      this.removePlaybackLine();
      return;
    }

    const quarterNoteDuration = this.getQuarterNoteDurationFromBpm();
    const baseToneNow = this.tone ? this.tone.now() : 0;

    setTimeout(() => {
      if (!this.isRecording) {
        this.removePlaybackLine();
        return;
      }

      const totalMelodyDurationMs =
        this.generatedNotes.reduce(
          (sum, note) => sum + (note.duration === "2n" ? 2 : 1) * quarterNoteDuration,
          0,
        ) * 1000;

      const lineStartX = this.generatedNotes[0].xPosition;
      const lineEndX = this.generatedNotes[this.generatedNotes.length - 1].xPosition;
      const travelDistance = lineEndX - lineStartX > 0 ? lineEndX - lineStartX : 1;
      let animationStartTime = null;

      const animateLine = (timestamp) => {
        if (!this.isRecording || !this.playbackLine) {
          return;
        }

        if (!animationStartTime) {
          animationStartTime = timestamp;
        }

        const elapsed = timestamp - animationStartTime;
        const progress = Math.min(elapsed / totalMelodyDurationMs, 1);
        const newX = lineStartX + progress * travelDistance;

        this.playbackLine.setAttribute("x1", String(newX));
        this.playbackLine.setAttribute("x2", String(newX));

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(animateLine);
        } else {
          this.removePlaybackLine();
        }
      };

      this.animationFrameId = requestAnimationFrame(animateLine);
    }, countInDuration * 1000);

    this.dom.messageBox.textContent = `Aufnahme läuft... (Note 1/${this.generatedNotes.length})`;
    this.pitchDetectionIntervalId = setInterval(() => {
      this.processAudioSlot();
    }, 60);

    let slotStartTime = countInDuration;

    for (let i = 0; i < this.generatedNotes.length; i += 1) {
      const noteDuration = (this.generatedNotes[i].duration === "2n" ? 2 : 1) * quarterNoteDuration;
      const slotEndTime = slotStartTime + noteDuration;

      if (this.dom.visualMetronomeToggle.checked && this.tone) {
        for (let beat = 0; beat < noteDuration; beat += quarterNoteDuration) {
          this.scheduleVisualMetronomePulse(baseToneNow + slotStartTime + beat, quarterNoteDuration);
        }
      }

      if (this.tone) {
        this.tone.Draw.schedule(() => {
          highlightCurrentNote(this.noteElementsArray, i);
        }, baseToneNow + slotStartTime);
      }

      setTimeout(() => {
        if (!this.isRecording) {
          return;
        }

        this.analyzeAndStoreSlotPitch();
        this.currentRecordingSlot += 1;

        if (this.currentRecordingSlot < this.generatedNotes.length) {
          this.dom.messageBox.textContent = `Aufnahme läuft... (Note ${this.currentRecordingSlot + 1}/${this.generatedNotes.length})`;
          highlightCurrentNote(this.noteElementsArray, this.currentRecordingSlot);
          this.clearLiveFeedbackMarker();
        }
      }, slotEndTime * 1000 - 50);

      slotStartTime = slotEndTime;
    }

    setTimeout(() => {
      if (this.isRecording) {
        this.stopRecordingAndDisplay();
      }
    }, slotStartTime * 1000 + 200);
  }

  stopRecordingAndDisplay() {
    if (!this.isRecording && !this.pitchDetectionIntervalId) {
      return;
    }

    this.isRecording = false;

    if (this.pitchDetectionIntervalId) {
      clearInterval(this.pitchDetectionIntervalId);
      this.pitchDetectionIntervalId = null;
    }

    if (this.visualMetronomeIntervalId) {
      clearInterval(this.visualMetronomeIntervalId);
      this.visualMetronomeIntervalId = null;
      this.dom.visualMetronomeIndicator.classList.remove("active");
    }

    if (this.tone) {
      this.tone.Transport.cancel();
    }

    this.clickSynth?.triggerRelease();
    this.melodySynth?.triggerRelease();

    highlightCurrentNote(this.noteElementsArray, -1);
    this.removePlaybackLine();
    this.clearLiveFeedbackMarker();

    this.disconnectMicrophone();

    this.dom.messageBox.textContent = "Aufnahme beendet. Ergebnisse werden angezeigt.";
    this.dom.detectedNoteDebug.textContent = "";

    drawStaffOnSvg(this.dom.recordedStaffSvg, MIDDLE_LINE_D3_Y_RECORDED);

    const availableWidth = SVG_STAFF_WIDTH - (STAFF_MARGIN_LEFT + 100) - STAFF_MARGIN_LEFT;
    const totalDurationUnits = this.generatedNotes.reduce(
      (sum, note) => sum + (note.duration === "2n" ? 2 : 1),
      0,
    );
    const widthPerUnit = totalDurationUnits > 0 ? availableWidth / totalDurationUnits : 0;

    let currentX = STAFF_MARGIN_LEFT + 100;

    for (let i = 0; i < this.recordedNotesDisplay.length; i += 1) {
      const recordedNote = this.recordedNotesDisplay[i];
      const originalNote = this.generatedNotes[i];
      if (!originalNote) {
        continue;
      }

      const noteWidth = (originalNote.duration === "2n" ? 2 : 1) * widthPerUnit;
      const noteXPosition = currentX;

      if (recordedNote) {
        drawNoteOnSvg({
          svgElement: this.dom.recordedStaffSvg,
          middleLineY: MIDDLE_LINE_D3_Y_RECORDED,
          noteData: { ...recordedNote, duration: originalNote.duration },
          xPosition: noteXPosition,
          noteColor: recordedNote.color,
        });
      }

      currentX += noteWidth;
    }

    const totalNotes = this.generatedNotes.length;
    const correctNotes = this.recordedNotesDisplay.filter((note) => note && note.color === NOTE_COLOR_DEFAULT).length;
    const accuracy = totalNotes > 0 ? correctNotes / totalNotes : 0;

    if (typeof this.options.onMelodyEvaluated === "function") {
      this.options.onMelodyEvaluated({
        totalNotes,
        correctNotes,
        accuracy,
        generatedNotes: this.generatedNotes.map((note) => ({ ...note })),
        recordedNotes: this.recordedNotesDisplay.map((note) => (note ? { ...note } : null)),
      });
    }
  }

  disconnectMicrophone() {
    if (!this.microphoneSourceNode) {
      return;
    }

    this.microphoneSourceNode.disconnect();
    this.microphoneSourceNode.mediaStream?.getTracks().forEach((track) => track.stop());
    this.microphoneSourceNode = null;
  }

  stopAllAudioAndRecording() {
    if (this.tone) {
      this.tone.Transport.stop();
      this.tone.Transport.cancel();
    }

    this.melodySynth?.triggerRelease();
    this.clickSynth?.triggerRelease();

    if (this.pitchDetectionIntervalId) {
      clearInterval(this.pitchDetectionIntervalId);
      this.pitchDetectionIntervalId = null;
    }

    if (this.visualMetronomeIntervalId) {
      clearInterval(this.visualMetronomeIntervalId);
      this.visualMetronomeIntervalId = null;
    }

    this.isRecording = false;
    this.detectedPitchesInSlot = [];

    highlightCurrentNote(this.noteElementsArray, -1);
    this.removePlaybackLine();
    this.clearLiveFeedbackMarker();
    this.disconnectMicrophone();

    this.dom.visualMetronomeIndicator.classList.remove("active");

    if (this.isContinuousDetectionActive) {
      this.stopContinuousDetection();
    }

    this.dom.messageBox.textContent = "Alle Vorgänge gestoppt.";
    this.dom.detectedNoteDebug.textContent = "";
  }

  async toggleContinuousDetection() {
    if (this.isContinuousDetectionActive) {
      this.stopContinuousDetection();
      return;
    }

    await this.startContinuousDetection();
  }

  async startContinuousDetection() {
    this.stopAllAudioAndRecording();

    const audioReady = await this.initAudioRecording();
    if (!audioReady) {
      return;
    }

    this.isContinuousDetectionActive = true;
    this.dom.continuousDetectionBtn.textContent = "Fortlaufende Notenerkennung stoppen";
    this.dom.continuousDetectionBtn.classList.remove("bg-purple-500", "hover:bg-purple-600");
    this.dom.continuousDetectionBtn.classList.add("bg-red-500", "hover:bg-red-600");
    this.dom.detectionStatus.textContent = "Aktiv";
    this.dom.detectionStatus.classList.add("text-green-500");

    this.continuousDetectionIntervalId = setInterval(() => {
      this.detectAndDisplayCurrentNote();
    }, 100);
  }

  stopContinuousDetection() {
    if (this.continuousDetectionIntervalId) {
      clearInterval(this.continuousDetectionIntervalId);
      this.continuousDetectionIntervalId = null;
    }

    this.disconnectMicrophone();

    this.isContinuousDetectionActive = false;
    this.clearLiveFeedbackMarker();
    this.dom.continuousDetectionBtn.textContent = "Fortlaufende Notenerkennung starten";
    this.dom.continuousDetectionBtn.classList.remove("bg-red-500", "hover:bg-red-600");
    this.dom.continuousDetectionBtn.classList.add("bg-purple-500", "hover:bg-purple-600");
    this.dom.detectionStatus.textContent = "Inaktiv";
    this.dom.detectionStatus.classList.remove("text-green-500");
    this.dom.detectedFrequency.textContent = "-";
    this.dom.detectedNoteName.textContent = "-";
  }

  detectAndDisplayCurrentNote() {
    if (!this.analyser || !this.audioContext) {
      return;
    }

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    const frequency = autoCorrelate(buffer, this.audioContext.sampleRate);

    if (frequency === -1) {
      this.dom.detectedFrequency.textContent = "Keine Frequenz erkannt";
      this.dom.detectedNoteName.textContent = "-";
      return;
    }

    this.dom.detectedFrequency.textContent = `${frequency.toFixed(1)} Hz`;

    const midiNote = noteFromPitch(frequency);
    const noteName = midiToNoteName(midiNote, NOTE_STRINGS);

    if (noteName) {
      this.dom.detectedNoteName.textContent = `${noteName} (MIDI: ${midiNote})`;
    } else {
      this.dom.detectedNoteName.textContent = `Unbekannte Note (MIDI: ${midiNote})`;
    }
  }

  async playClickedNote(event) {
    const clickedGroup = event.target.closest(".clickable-note");
    if (!clickedGroup || !this.melodySynth || !this.tone) {
      return;
    }

    const scientific = clickedGroup.dataset.noteScientific;
    const duration = clickedGroup.dataset.noteDuration || "4n";

    if (!scientific) {
      return;
    }

    try {
      await this.ensureToneStarted();
      this.melodySynth.triggerAttackRelease(scientific, duration, this.tone.now());
    } catch (error) {
      console.error("Failed to play clicked note:", error);
    }
  }
}
