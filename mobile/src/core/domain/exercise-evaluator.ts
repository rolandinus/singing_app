import type { EvaluationResult, Exercise } from '../types';

function midiToFrequency(midi: number): number {
  return 440 * (2 ** ((midi - 69) / 12));
}

function centsDifferenceFromFrequency(detectedFrequency: number, targetMidi: number): number {
  const targetFrequency = midiToFrequency(targetMidi);
  return 1200 * Math.log2(detectedFrequency / targetFrequency);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class ExerciseEvaluator {
  evaluate(exercise: Exercise | null, submission: any, options: { toleranceCents?: number } = {}): EvaluationResult {
    const defaultResult: EvaluationResult = {
      correct: false,
      score: 0,
      accuracyDetail: {},
      feedback: 'Nicht bewertet',
      telemetry: {},
    };

    if (!exercise) {
      return defaultResult;
    }

    if (exercise.family !== 'singing') {
      const expected = String((exercise.expectedAnswer as any).answer);
      const actual = String(submission?.answer ?? '');
      const correct = actual === expected;

      return {
        correct,
        score: correct ? 1 : 0,
        accuracyDetail: { expected, actual },
        feedback: correct ? 'Richtig' : 'Nicht korrekt',
        telemetry: {},
      };
    }

    const targetMidi = (exercise.expectedAnswer as any).targetMidi;
    const detectedMidi = submission?.detectedMidi;
    const detectedFrequency = submission?.detectedFrequency;

    if (detectedMidi === null || detectedMidi === undefined || !Number.isFinite(detectedMidi)) {
      return {
        correct: false,
        score: 0,
        accuracyDetail: { reason: 'no_pitch' },
        feedback: 'Keine stabile Tonhöhe erkannt',
        telemetry: {},
      };
    }

    const toleranceCents = Number(options.toleranceCents ?? 50);

    let centsOff: number;
    if (Number.isFinite(detectedFrequency)) {
      centsOff = centsDifferenceFromFrequency(detectedFrequency, targetMidi);
    } else {
      centsOff = (detectedMidi - targetMidi) * 100;
    }

    const absCents = Math.abs(centsOff);
    const correct = absCents <= toleranceCents;
    const score = clamp01(1 - absCents / (toleranceCents * 2));

    return {
      correct,
      score,
      accuracyDetail: {
        targetMidi,
        detectedMidi,
        centsOff,
        toleranceCents,
      },
      feedback: correct ? `Treffer (${centsOff.toFixed(1)} cents)` : `Abweichung ${centsOff.toFixed(1)} cents`,
      telemetry: { detectedFrequency },
    };
  }
}
