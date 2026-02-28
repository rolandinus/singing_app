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

    if (exercise.skillKey === 'sing_melody') {
      const targetMidis = Array.isArray((exercise.expectedAnswer as any).targetMidis)
        ? ((exercise.expectedAnswer as any).targetMidis as number[]).filter((midi) => Number.isFinite(midi))
        : [];
      const detectedMidis = Array.isArray(submission?.detectedMidis)
        ? (submission.detectedMidis as number[]).filter((midi) => Number.isFinite(midi))
        : [];
      const minAccuracy = Number((exercise.expectedAnswer as any).minAccuracy ?? 0.65);
      const toleranceCents = Number(options.toleranceCents ?? 50);

      if (targetMidis.length === 0 || detectedMidis.length === 0) {
        return {
          correct: false,
          score: 0,
          accuracyDetail: { reason: 'no_pitch' },
          feedback: 'Keine stabile Tonfolge erkannt',
          telemetry: {},
        };
      }

      const normalizedDetected = targetMidis.map((_, targetIdx) => {
        if (targetMidis.length === 1) return detectedMidis[0];
        const ratio = targetIdx / (targetMidis.length - 1);
        const sourceIdx = Math.round(ratio * (detectedMidis.length - 1));
        return detectedMidis[Math.max(0, Math.min(detectedMidis.length - 1, sourceIdx))];
      });

      const noteScores = targetMidis.map((targetMidi, idx) => {
        const centsOff = (normalizedDetected[idx] - targetMidi) * 100;
        return clamp01(1 - Math.abs(centsOff) / (toleranceCents * 2));
      });
      const averageNoteScore = noteScores.reduce((sum, value) => sum + value, 0) / noteScores.length;
      const lengthCoverage = Math.min(detectedMidis.length, targetMidis.length) / Math.max(detectedMidis.length, targetMidis.length);
      const score = clamp01(averageNoteScore * lengthCoverage);
      const correct = score >= minAccuracy;

      return {
        correct,
        score,
        accuracyDetail: {
          targetMidis,
          detectedMidis,
          normalizedDetected,
          minAccuracy,
          toleranceCents,
          lengthCoverage,
        },
        feedback: correct
          ? `Melodie korrekt (${Math.round(score * 100)}%)`
          : `Melodie abweichend (${Math.round(score * 100)}%)`,
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
