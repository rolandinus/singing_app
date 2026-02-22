export class EarTrainingPlayer {
  constructor(tone = window.Tone ?? null) {
    this.tone = tone;
    this.synth = null;
    this.clickSynth = null;
  }

  init() {
    if (!this.tone || this.synth) {
      return;
    }

    this.synth = new this.tone.Synth().toDestination();
    this.clickSynth = new this.tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.1,
      },
    }).toDestination();

    this.clickSynth.volume.value = -12;
  }

  async ensureReady() {
    this.init();
    if (!this.tone || !this.synth) {
      return false;
    }

    if (this.tone.context.state !== "running") {
      await this.tone.start();
    }

    return true;
  }

  async playNote(scientific, durationSeconds = 0.8) {
    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    this.synth.triggerAttackRelease(scientific, durationSeconds, this.tone.now());
  }

  async playInterval(firstScientific, secondScientific, { gapSeconds = 0.25, durationSeconds = 0.7 } = {}) {
    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    const now = this.tone.now();
    this.synth.triggerAttackRelease(firstScientific, durationSeconds, now);
    this.synth.triggerAttackRelease(secondScientific, durationSeconds, now + durationSeconds + gapSeconds);
  }

  async playReferenceWithTarget(referenceScientific, targetScientific) {
    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    const now = this.tone.now();
    this.synth.triggerAttackRelease(referenceScientific, 0.8, now);
    this.synth.triggerAttackRelease(targetScientific, 0.8, now + 1.1);
  }
}
