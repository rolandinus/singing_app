import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { buildSynthToneWavDataUri } from './synth-tone';

function scientificToMidi(note: string): number {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(String(note).trim());
  if (!match) {
    return 60;
  }

  const [, letter, sharp, octaveRaw] = match;
  const octave = Number(octaveRaw);
  const offsets: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitone = (offsets[letter] ?? 0) + (sharp ? 1 : 0);
  return (octave + 1) * 12 + semitone;
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

async function waitForPlayerCompletion(
  player: AudioPlayer,
  expectedDurationMs: number,
  shouldAbort: () => boolean,
): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        subscription.remove();
        clearInterval(abortPoll);
        clearTimeout(fallback);
        resolve();
      }
    };

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded || status.didJustFinish) {
        done();
      }
    });

    // Poll the abort flag frequently so stop() takes effect within one tick even
    // when the native player does not fire a status event after remove().
    const abortPoll = setInterval(() => {
      if (shouldAbort()) done();
    }, 50);

    const fallback = setTimeout(done, Math.max(2000, expectedDurationMs + 900));
  });
}

export class ExpoAudioPromptPort {
  private static configured = false;
  private activePlayer: AudioPlayer | null = null;
  /** Incremented on every stop() call; playTone captures the value at start and aborts if it changes. */
  private stopGeneration = 0;

  private async ensureAudioMode() {
    if (ExpoAudioPromptPort.configured) {
      return;
    }

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });

    ExpoAudioPromptPort.configured = true;
  }

  private async playTone(note: string, durationMs = 650): Promise<boolean> {
    const generation = this.stopGeneration;
    const midi = scientificToMidi(note);
    const frequency = midiToFrequency(midi);
    const uri = buildSynthToneWavDataUri(frequency, durationMs);

    // Abort immediately if stop() was called since this playback was requested.
    if (generation !== this.stopGeneration) return false;

    const player = createAudioPlayer({ uri });
    this.activePlayer = player;
    player.play();
    await waitForPlayerCompletion(player, durationMs, () => generation !== this.stopGeneration);
    try {
      player.remove();
    } catch {}
    if (this.activePlayer === player) {
      this.activePlayer = null;
    }
    // Return false if a stop() was issued while this tone was playing.
    return generation === this.stopGeneration;
  }

  async playInterval(first: string, second: string): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    const gen = this.stopGeneration;
    const ok = await this.playTone(first);
    if (!ok) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (this.stopGeneration !== gen) return;
    await this.playTone(second);
  }

  async playNote(note: string, durationMs?: number): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    await this.playTone(note, durationMs);
  }

  async playReferenceWithTarget(reference: string, target: string): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    const gen = this.stopGeneration;
    const ok = await this.playTone(reference);
    if (!ok) return;
    await new Promise((resolve) => setTimeout(resolve, 220));
    if (this.stopGeneration !== gen) return;
    await this.playTone(target);
  }

  async playMelody(notes: string[]): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    const sequence = Array.isArray(notes) ? notes : [];
    const gen = this.stopGeneration;

    for (let i = 0; i < sequence.length; i += 1) {
      if (this.stopGeneration !== gen) return;
      const ok = await this.playTone(String(sequence[i]));
      if (!ok) return;
      if (i < sequence.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 140));
        // Check again after the gap in case stop() was called during the pause.
        if (this.stopGeneration !== gen) return;
      }
    }
  }

  /**
   * Play a melody with per-note durations and a configurable gap between notes.
   * Respects stop() cancellation between every note and every gap.
   */
  async playMelodyWithDurations(notes: Array<{ pitch: string; durationMs: number }>, gapMs: number): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    const gen = this.stopGeneration;

    for (let i = 0; i < notes.length; i += 1) {
      if (this.stopGeneration !== gen) return;
      const noteObj = notes[i];
      if (!noteObj) continue;
      const ok = await this.playTone(noteObj.pitch, noteObj.durationMs);
      if (!ok) return;
      if (i < notes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, gapMs));
        // Check again after the gap in case stop() was called during the pause.
        if (this.stopGeneration !== gen) return;
      }
    }
  }

  async stop(): Promise<void> {
    // Increment the generation counter so any in-progress playTone call knows to abort.
    this.stopGeneration += 1;

    const player = this.activePlayer;
    this.activePlayer = null;

    if (!player) return;

    try {
      player.pause();
    } catch {}
    try {
      player.remove();
    } catch {}
  }
}
