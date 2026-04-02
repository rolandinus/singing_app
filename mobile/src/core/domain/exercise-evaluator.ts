import type { EvaluationResult, Exercise } from '../types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function noteScore(detectedMidi: number, targetMidi: number, toleranceCents: number): number {
  if (Math.abs(detectedMidi - targetMidi) === 12) return 0.5;
  const centsOff = Math.abs((detectedMidi - targetMidi) * 100);
  return clamp01(1 - centsOff / (toleranceCents * 2));
}

function noPitchResult(feedback: string): EvaluationResult {
  return { correct: false, score: 0, accuracyDetail: { reason: 'no_pitch' }, feedback, telemetry: {} };
}

function detectOctaveShift(targetMidis: number[], detectedMidis: Array<number | null>): 'high' | 'low' | null {
  const pairs = targetMidis
    .map((target, i) => ({ target, detected: detectedMidis[i] ?? null }))
    .filter((p): p is { target: number; detected: number } => Number.isFinite(p.detected));
  if (pairs.length === 0) return null;
  const highCount = pairs.filter((p) => p.detected - p.target === 12).length;
  const lowCount = pairs.filter((p) => p.detected - p.target === -12).length;
  if (highCount > pairs.length / 2) return 'high';
  if (lowCount > pairs.length / 2) return 'low';
  return null;
}

export class ExerciseEvaluator {
  evaluate(exercise: Exercise | null, submission: any, options: { toleranceCents?: number } = {}): EvaluationResult {
    if (!exercise) {
      return { correct: false, score: 0, accuracyDetail: {}, feedback: 'Nicht bewertet', telemetry: {} };
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
      const detectedMidisBySlot = Array.isArray(submission?.detectedMidisBySlot)
        ? (submission.detectedMidisBySlot as Array<number | null>).map((value) => (
          Number.isFinite(value) ? Number(value) : null
        ))
        : null;
      const minAccuracy = Number((exercise.expectedAnswer as any).minAccuracy ?? 0.65);
      const toleranceCents = Number(options.toleranceCents ?? 50);

      if (targetMidis.length === 0) {
        return noPitchResult('Keine stabile Tonfolge erkannt');
      }

      if (detectedMidisBySlot) {
        const normalizedDetected: Array<number | null> = targetMidis.map((_, idx) => detectedMidisBySlot[idx] ?? null);
        const detectedCount = normalizedDetected.filter((value) => Number.isFinite(value)).length;
        if (detectedCount === 0) {
          return noPitchResult('Keine stabile Tonfolge erkannt');
        }

        const noteScores = targetMidis.map((targetMidi, idx) => {
          const detectedMidi = normalizedDetected[idx];
          if (!Number.isFinite(detectedMidi)) return 0;
          return noteScore(Number(detectedMidi), targetMidi, toleranceCents);
        });
        const averageNoteScore = noteScores.reduce((sum, value) => sum + value, 0) / noteScores.length;
        const lengthCoverage = detectedCount / targetMidis.length;
        const score = clamp01(averageNoteScore);
        const correct = score >= minAccuracy;

        const octaveShift = !correct ? detectOctaveShift(targetMidis, normalizedDetected) : null;
        const octaveHint = octaveShift === 'high' ? ' – Eine Oktave zu hoch' : octaveShift === 'low' ? ' – Eine Oktave zu tief' : '';
        return {
          correct,
          score,
          accuracyDetail: {
            targetMidis,
            detectedMidis: normalizedDetected.filter((midi): midi is number => Number.isFinite(midi)),
            normalizedDetected,
            minAccuracy,
            toleranceCents,
            lengthCoverage,
          },
          feedback: correct
            ? `Melodie korrekt (${Math.round(score * 100)}%)`
            : `Melodie abweichend (${Math.round(score * 100)}%)${octaveHint}`,
          telemetry: {},
        };
      }

      if (detectedMidis.length === 0) {
        return noPitchResult('Keine stabile Tonfolge erkannt');
      }

      const normalizedDetected = targetMidis.map((_, targetIdx) => {
        if (targetMidis.length === 1) return detectedMidis[0];
        const ratio = targetIdx / (targetMidis.length - 1);
        const sourceIdx = Math.round(ratio * (detectedMidis.length - 1));
        return detectedMidis[Math.max(0, Math.min(detectedMidis.length - 1, sourceIdx))];
      });

      const noteScores = targetMidis.map((targetMidi, idx) => {
        return noteScore(normalizedDetected[idx], targetMidi, toleranceCents);
      });
      const averageNoteScore = noteScores.reduce((sum, value) => sum + value, 0) / noteScores.length;
      const lengthCoverage = Math.min(detectedMidis.length, targetMidis.length) / Math.max(detectedMidis.length, targetMidis.length);
      const score = clamp01(averageNoteScore * lengthCoverage);
      const correct = score >= minAccuracy;

      const octaveShiftLegacy = !correct ? detectOctaveShift(targetMidis, normalizedDetected) : null;
      const octaveHintLegacy = octaveShiftLegacy === 'high' ? ' – Eine Oktave zu hoch' : octaveShiftLegacy === 'low' ? ' – Eine Oktave zu tief' : '';
      return {
        correct,
        score,
        accuracyDetail: { targetMidis, detectedMidis, normalizedDetected, minAccuracy, toleranceCents, lengthCoverage },
        feedback: correct
          ? `Melodie korrekt (${Math.round(score * 100)}%)`
          : `Melodie abweichend (${Math.round(score * 100)}%)${octaveHintLegacy}`,
        telemetry: {},
      };
    }

    const targetMidi = (exercise.expectedAnswer as any).targetMidi;
    const detectedMidi = submission?.detectedMidi;
    const detectedFrequency = submission?.detectedFrequency;

    if (detectedMidi === null || detectedMidi === undefined || !Number.isFinite(detectedMidi)) {
      return noPitchResult('Keine stabile Tonhöhe erkannt');
    }

    const toleranceCents = Number(options.toleranceCents ?? 50);
    const centsOff = Number.isFinite(detectedFrequency)
      ? 1200 * Math.log2(detectedFrequency / (440 * (2 ** ((targetMidi - 69) / 12))))
      : (detectedMidi - targetMidi) * 100;

    const absCents = Math.abs(centsOff);
    const correct = absCents <= toleranceCents;
    const score = clamp01(1 - absCents / (toleranceCents * 2));

    return {
      correct,
      score,
      accuracyDetail: { targetMidi, detectedMidi, centsOff, toleranceCents },
      feedback: correct ? `Treffer (${centsOff.toFixed(1)} cents)` : `Abweichung ${centsOff.toFixed(1)} cents`,
      telemetry: { detectedFrequency },
    };
  }
}
