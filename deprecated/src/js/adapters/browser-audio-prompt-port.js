import { AudioPromptPort } from "../ports/audio-prompt-port.js";
import { EarTrainingPlayer } from "../audio/ear-training-player.js";

export class BrowserAudioPromptPort extends AudioPromptPort {
  constructor({ player = new EarTrainingPlayer(window.Tone ?? null) } = {}) {
    super();
    this.player = player;
  }

  async playNote(scientific, durationSeconds = 0.8) {
    await this.player.playNote(scientific, durationSeconds);
  }

  async playInterval(firstScientific, secondScientific, options = {}) {
    await this.player.playInterval(firstScientific, secondScientific, options);
  }

  async playReferenceWithTarget(referenceScientific, targetScientific) {
    await this.player.playReferenceWithTarget(referenceScientific, targetScientific);
  }
}
