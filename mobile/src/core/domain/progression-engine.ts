import { MASTERY_THRESHOLD, MAX_LEVEL, ROLLING_WINDOW_SIZE } from '../config/curriculum';
import type { EvaluationResult, ProgressRecord } from '../types';

export function createDefaultProgressRecord(skillKey: string): ProgressRecord {
  return {
    skillKey,
    level: 1,
    mastery: 0,
    attemptsTotal: 0,
    correctTotal: 0,
    rolling: [],
    readyToLevelUp: false,
    lastPracticedAt: null,
  };
}

export class ProgressionEngine {
  applyEvaluation(progressRecord: ProgressRecord, evaluationResult: EvaluationResult, timestampIso: string) {
    const record: ProgressRecord = progressRecord ? { ...progressRecord } : createDefaultProgressRecord('unknown');

    record.attemptsTotal += 1;
    if (evaluationResult.correct) {
      record.correctTotal += 1;
    }

    record.rolling = [...(record.rolling ?? []), Boolean(evaluationResult.correct)].slice(-ROLLING_WINDOW_SIZE);

    const rollingCorrect = record.rolling.filter(Boolean).length;
    const rollingAccuracy = record.rolling.length > 0 ? rollingCorrect / record.rolling.length : 0;

    record.mastery = Math.round(rollingAccuracy * 100);
    record.lastPracticedAt = timestampIso;
    record.readyToLevelUp = false;

    let leveledUp = false;

    if (record.rolling.length >= ROLLING_WINDOW_SIZE && rollingAccuracy >= MASTERY_THRESHOLD && record.level < MAX_LEVEL) {
      record.level += 1;
      record.rolling = [];
      record.mastery = 0;
      record.readyToLevelUp = true;
      leveledUp = true;
    }

    return { record, leveledUp };
  }
}
