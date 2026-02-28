import { SESSION_DISTRIBUTION, SKILL_DEFINITIONS } from '../config/curriculum';
import type { Clef, ExerciseFamily, SkillKey } from '../types';

function buildSkillEntries(
  enabledClefs: Clef[],
  progressBySkill: Map<string, any>,
  includeFamilies: ExerciseFamily[] | null = null,
) {
  const entries: Array<{ clef: Clef; skillKey: SkillKey; mastery: number; level: number }> = [];
  const familySet = includeFamilies ? new Set(includeFamilies) : null;

  enabledClefs.forEach((clef) => {
    SKILL_DEFINITIONS.forEach((skill) => {
      if (familySet && !familySet.has(skill.family)) {
        return;
      }

      const progressKey = `${clef}.${skill.key}`;
      const record = progressBySkill.get(progressKey);

      entries.push({
        clef,
        skillKey: skill.key,
        mastery: record?.mastery ?? 0,
        level: record?.level ?? 1,
      });
    });
  });

  return entries;
}

export class SessionPlanner {
  generateGuidedSession({
    enabledClefs,
    progressBySkill,
    exerciseCount,
    generator,
    includeFamilies = null,
  }: {
    enabledClefs: Clef[];
    progressBySkill: Map<string, any>;
    exerciseCount: number;
    generator: any;
    includeFamilies?: ExerciseFamily[] | null;
  }) {
    const entries = buildSkillEntries(enabledClefs, progressBySkill, includeFamilies).sort((a, b) => {
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      return a.level - b.level;
    });

    if (entries.length === 0) return [];

    const total = Math.max(5, exerciseCount);
    const focusCount = Math.max(1, Math.round(total * SESSION_DISTRIBUTION.focus));
    const mixedCount = Math.max(1, Math.round(total * SESSION_DISTRIBUTION.mixed));
    const reviewCount = Math.max(1, total - focusCount - mixedCount);

    const focus = entries[0];
    const mixedPool = entries;
    const reviewPool = entries.slice(0, Math.min(4, entries.length));

    const queue: any[] = [];

    for (let i = 0; i < focusCount; i += 1) {
      queue.push(generator.generate({ skillKey: focus.skillKey, clef: focus.clef, level: focus.level }));
    }

    for (let i = 0; i < mixedCount; i += 1) {
      const entry = mixedPool[i % mixedPool.length];
      queue.push(generator.generate({ skillKey: entry.skillKey, clef: entry.clef, level: entry.level }));
    }

    for (let i = 0; i < reviewCount; i += 1) {
      const entry = reviewPool[i % reviewPool.length];
      const reviewLevel = Math.max(1, entry.level - 1);
      queue.push(generator.generate({ skillKey: entry.skillKey, clef: entry.clef, level: reviewLevel }));
    }

    return queue.slice(0, total);
  }

  generateCustomSession({
    skillKey,
    clef,
    level,
    count,
    generator,
  }: {
    skillKey: SkillKey;
    clef: Clef;
    level: number;
    count: number;
    generator: any;
  }) {
    const total = Math.max(1, count);
    const queue: any[] = [];

    for (let i = 0; i < total; i += 1) {
      queue.push(generator.generate({ skillKey, clef, level }));
    }

    return queue;
  }
}
