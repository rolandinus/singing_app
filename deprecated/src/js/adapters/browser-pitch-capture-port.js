import { NOTE_STRINGS } from "../config/constants.js";
import { autoCorrelate, midiToNoteName, noteFromPitch } from "../utils/pitch.js";
import { PitchCapturePort } from "../ports/pitch-capture-port.js";

export class BrowserPitchCapturePort extends PitchCapturePort {
  constructor() {
    super();
    this.audioContext = null;
    this.analyser = null;
    this.microphoneSourceNode = null;
  }

  async #ensureMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Mikrofonzugriff nicht verfügbar.");
    }

    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.minDecibels = -100;
      this.analyser.maxDecibels = -10;
      this.analyser.smoothingTimeConstant = 0.7;
      this.analyser.fftSize = 2048;
    }

    if (!this.microphoneSourceNode) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.microphoneSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.microphoneSourceNode.connect(this.analyser);
    }
  }

  stop() {
    if (!this.microphoneSourceNode) {
      return;
    }

    this.microphoneSourceNode.disconnect();
    this.microphoneSourceNode.mediaStream?.getTracks().forEach((track) => track.stop());
    this.microphoneSourceNode = null;
  }

  async capturePitchSample(durationMs) {
    await this.#ensureMicrophone();

    return new Promise((resolve) => {
      const frequencies = [];
      const startedAt = performance.now();

      const intervalId = setInterval(() => {
        if (!this.analyser || !this.audioContext) {
          return;
        }

        const buffer = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(buffer);

        const frequency = autoCorrelate(buffer, this.audioContext.sampleRate);
        if (frequency !== -1 && Number.isFinite(frequency)) {
          frequencies.push(frequency);
        }

        if (performance.now() - startedAt >= durationMs) {
          clearInterval(intervalId);

          if (frequencies.length === 0) {
            this.stop();
            resolve(null);
            return;
          }

          const sorted = [...frequencies].sort((a, b) => a - b);
          const medianFrequency = sorted[Math.floor(sorted.length / 2)];
          const detectedMidi = noteFromPitch(medianFrequency);

          resolve({
            detectedFrequency: medianFrequency,
            detectedMidi,
            noteName: midiToNoteName(detectedMidi, NOTE_STRINGS),
          });
          this.stop();
        }
      }, 60);
    });
  }
}
