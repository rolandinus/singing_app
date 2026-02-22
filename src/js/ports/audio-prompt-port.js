/**
 * AudioPromptPort abstraction.
 * Implementations play prompts for ear/singing exercises.
 */
export class AudioPromptPort {
  async playNote(_scientific, _durationSeconds = 0.8) {
    throw new Error("AudioPromptPort.playNote() not implemented");
  }

  async playInterval(_firstScientific, _secondScientific, _options = {}) {
    throw new Error("AudioPromptPort.playInterval() not implemented");
  }

  async playReferenceWithTarget(_referenceScientific, _targetScientific) {
    throw new Error("AudioPromptPort.playReferenceWithTarget() not implemented");
  }
}
