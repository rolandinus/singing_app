import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { buildMetronomeClickWavDataUri, buildSynthToneWavDataUri } from './synth-tone';
import { scientificToMidi } from '../../core/utils/note-helpers';
import { midiToFrequency } from '../../core/utils/pitch';

function noteToFrequency(note: string): number {
  const midi = scientificToMidi(note);
  return midiToFrequency(midi ?? 60);
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
   *
   * All notes are scheduled at absolute offsets from a single t0 so inter-note
   * timing does not accumulate drift from playback completion events.
   * WAV URIs are pre-built before scheduling to avoid per-note build latency.
   * Respects stop() cancellation.
   */
  async playMelodyWithDurations(notes: Array<{ pitch: string; durationMs: number }>, gapMs: number): Promise<void> {
    await this.stop();
    await this.ensureAudioMode();
    const gen = this.stopGeneration;
    if (notes.length === 0) return;

    // Build all WAV buffers upfront so setTimeout callbacks are fast.
    const uris = notes.map((n) => buildSynthToneWavDataUri(noteToFrequency(n.pitch), n.durationMs));

    const t0 = Date.now();
    let offsetMs = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < notes.length; i += 1) {
      const noteOffsetMs = offsetMs;
      const uri = uris[i];
      const noteDurationMs = notes[i].durationMs;
      timers.push(setTimeout(() => {
        if (this.stopGeneration !== gen) return;
        const player = createAudioPlayer({ uri });
        this.activePlayer = player;
        player.play();
        // Schedule player cleanup after the note finishes.
        setTimeout(() => {
          try { player.remove(); } catch {}
          if (this.activePlayer === player) this.activePlayer = null;
        }, noteDurationMs + 300);
      }, noteOffsetMs));
      offsetMs += noteDurationMs + (i < notes.length - 1 ? gapMs : 0);
    }

    // offsetMs now equals the total melody duration (end of last note).
    // Poll until done or cancelled.
    const endAt = t0 + offsetMs + 200;
    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (this.stopGeneration !== gen || Date.now() >= endAt) {
          clearInterval(poll);
          timers.forEach(clearTimeout);
          resolve();
        }
      }, 50);
    });
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
