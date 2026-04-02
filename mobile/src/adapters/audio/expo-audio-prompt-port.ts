import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { buildMetronomeClickWavDataUri, buildSynthToneWavDataUri } from './synth-tone';

function noteToFrequency(note: string): number {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(String(note).trim());
  if (!match) return 440 * 2 ** ((60 - 69) / 12);
  const [, letter, sharp, octaveRaw] = match;
  const offsets: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitone = (offsets[letter] ?? 0) + (sharp ? 1 : 0);
  const midi = (Number(octaveRaw) + 1) * 12 + semitone;
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

    let hasBeenLoaded = false;
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) {
        hasBeenLoaded = true;
      }
      // Ignore the initial !isLoaded event fired before playback starts.
      // Only resolve on explicit finish or on an unload that follows a successful load.
      if (status.didJustFinish || (hasBeenLoaded && !status.isLoaded)) {
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
    if (ExpoAudioPromptPort.configured) return;
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });
    ExpoAudioPromptPort.configured = true;
  }

  private async playAudioUri(uri: string, durationMs: number, generation: number): Promise<boolean> {
    if (generation !== this.stopGeneration) return false;
    const player = createAudioPlayer({ uri });
    this.activePlayer = player;
    player.play();
    await waitForPlayerCompletion(player, durationMs, () => generation !== this.stopGeneration);
    try { player.remove(); } catch {}
    if (this.activePlayer === player) this.activePlayer = null;
    return generation === this.stopGeneration;
  }

  private async playTone(note: string, durationMs = 650): Promise<boolean> {
    const generation = this.stopGeneration;
    const uri = buildSynthToneWavDataUri(noteToFrequency(note), durationMs);
    return this.playAudioUri(uri, durationMs, generation);
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
    const gen = this.stopGeneration;
    for (let i = 0; i < notes.length; i += 1) {
      if (this.stopGeneration !== gen) return;
      const ok = await this.playTone(notes[i]);
      if (!ok) return;
      if (i < notes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 140));
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
      const ok = await this.playTone(notes[i].pitch, notes[i].durationMs);
      if (!ok) return;
      if (i < notes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, gapMs));
        if (this.stopGeneration !== gen) return;
      }
    }
  }

  async playMetronomeTick(accent = false, durationMs = 90): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    // Use a MembraneSynth-style exponential pitch-sweep click, matching the
    // browser app (Tone.js MembraneSynth: pitchDecay=0.008, octaves=2).
    // Base frequency: C5 (~523 Hz) for accented beat 1, C4 (~262 Hz) otherwise.
    const baseFreq = accent ? 523.25 : 261.63;
    const safeDurationMs = Math.max(60, durationMs);
    const uri = buildMetronomeClickWavDataUri(baseFreq, accent, safeDurationMs);
    await this.playAudioUri(uri, safeDurationMs, this.stopGeneration);
  }

  async stop(): Promise<void> {
    // Increment the generation counter so any in-progress playTone call knows to abort.
    this.stopGeneration += 1;
    const player = this.activePlayer;
    this.activePlayer = null;
    if (!player) return;
    try { player.pause(); } catch {}
    try { player.remove(); } catch {}
  }
}
