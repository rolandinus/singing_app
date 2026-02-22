/**
 * PitchCapturePort abstraction.
 * Implementations capture and decode pitch from microphone input.
 */
export class PitchCapturePort {
  async capturePitchSample(_durationMs) {
    throw new Error("PitchCapturePort.capturePitchSample() not implemented");
  }

  stop() {}
}
