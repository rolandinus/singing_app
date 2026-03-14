import { CLEF_NOTE_RANGES, INTERVAL_LABELS, INTERVAL_QUALITY_LABELS, RHYTHM_PATTERNS } from '../config/curriculum';
import type { Clef, Exercise, MelodyNote, MelodyOptions, NoteType, SkillKey } from '../types';
import { buildDistractorChoices, getNaturalMidiPool, midiToScientific, noteLetter, randomChoice } from '../utils/note-helpers';

export const DEFAULT_MELODY_OPTIONS: MelodyOptions = {
  firstNoteMode: 'random',
  allowedIntervalSteps: [1, 2, 3],
};

function createExerciseId(skillKey: SkillKey): string {
  return `${skillKey}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function getIntervalStepsForLevel(level: number): number[] {
  if (level <= 1) return [1, 2, 3];
  if (level === 2) return [1, 2, 3, 4];
  if (level === 3) return [1, 2, 3, 4, 5];
  if (level === 4) return [1, 2, 3, 4, 5, 6, 7];
  return [1, 2, 3, 4, 5, 6, 7, 8];
}

function getLevelRange(clef: Clef, level: number) {
  const base = CLEF_NOTE_RANGES[clef] ?? CLEF_NOTE_RANGES.treble;
  const expansions = {
    treble: [
      { min: 60, max: 67 },
      { min: 60, max: 72 },
      { min: 59, max: 76 },
      { min: 57, max: 79 },
      { min: 55, max: 81 },
    ],
    bass: [
      { min: 43, max: 50 },
      { min: 41, max: 53 },
      { min: 40, max: 55 },
      { min: 38, max: 58 },
      { min: 36, max: 60 },
    ],
  } as const;

  const table = expansions[clef] ?? expansions.treble;
  const boundedLevel = Math.max(1, Math.min(table.length, level));
  const selected = table[boundedLevel - 1];

  return {
    minMidi: Math.max(base.minMidi, selected.min),
    maxMidi: Math.min(base.maxMidi, selected.max),
  };
}

function getNaturalPool(clef: Clef, level: number): number[] {
  const range = getLevelRange(clef, level);
  const pool = getNaturalMidiPool(range.minMidi, range.maxMidi);

  if (pool.length === 0) {
    return getNaturalMidiPool(CLEF_NOTE_RANGES[clef].minMidi, CLEF_NOTE_RANGES[clef].maxMidi);
  }

  return pool;
}

function generateIntervalPair(clef: Clef, level: number) {
  const pool = getNaturalPool(clef, level);
  const steps = getIntervalStepsForLevel(level);

  let attempts = 0;
  while (attempts < 100) {
    const intervalStep = randomChoice(steps);
    const index = Math.floor(Math.random() * pool.length);
    const direction = Math.random() < 0.5 ? 1 : -1;

    let targetIndex = index + (intervalStep - 1) * direction;
    if (targetIndex < 0 || targetIndex >= pool.length) {
      targetIndex = index - (intervalStep - 1) * direction;
    }

    if (targetIndex >= 0 && targetIndex < pool.length) {
      return {
        firstMidi: pool[index],
        secondMidi: pool[targetIndex],
        intervalStep,
      };
    }

    attempts += 1;
  }

  return {
    firstMidi: pool[0],
    secondMidi: pool[Math.min(pool.length - 1, 1)],
    intervalStep: 2,
  };
}

/** Return a random note duration: half note with 40% chance for first note, 25% for others. */
function randomNoteDuration(isFirst: boolean): NoteType {
  const chanceForHalf = isFirst ? 0.4 : 0.25;
  return Math.random() < chanceForHalf ? 'half' : 'quarter';
}

type MelodyNoteRaw = { midi: number; duration: NoteType };

function generateMelodyNotes(clef: Clef, level: number, options: MelodyOptions): MelodyNoteRaw[] {
  const pool = getNaturalPool(clef, level).sort((a, b) => a - b);
  if (pool.length === 0) {
    return [
      { midi: 60, duration: 'quarter' },
      { midi: 62, duration: 'quarter' },
      { midi: 64, duration: 'half' },
    ];
  }

  // Resolve start note index from firstNoteMode.
  let startMidi: number;
  if (options.firstNoteMode === 'C2') {
    const c2Midi = 36; // MIDI 36 = C2
    startMidi = pool.reduce((closest, m) => (Math.abs(m - c2Midi) < Math.abs(closest - c2Midi) ? m : closest), pool[0]);
  } else if (options.firstNoteMode === 'C4') {
    const c4Midi = 60; // MIDI 60 = C4
    startMidi = pool.reduce((closest, m) => (Math.abs(m - c4Midi) < Math.abs(closest - c4Midi) ? m : closest), pool[0]);
  } else if (options.firstNoteMode === 'C6') {
    const c6Midi = 84; // MIDI 84 = C6
    startMidi = pool.reduce((closest, m) => (Math.abs(m - c6Midi) < Math.abs(closest - c6Midi) ? m : closest), pool[0]);
  } else {
    startMidi = randomChoice(pool);
  }

  let index = pool.indexOf(startMidi);
  if (index < 0) index = 0;

  const noteCount = Math.max(3, Math.min(6, level + 2));
  const steps = options.allowedIntervalSteps.length > 0 ? options.allowedIntervalSteps : DEFAULT_MELODY_OPTIONS.allowedIntervalSteps;
  const notes: MelodyNoteRaw[] = [{ midi: pool[index], duration: randomNoteDuration(true) }];

  for (let i = 1; i < noteCount; i += 1) {
    const step = randomChoice(steps);
    const direction = Math.random() < 0.6 ? 1 : -1;
    let next = index + step * direction;

    if (next < 0 || next >= pool.length) {
      next = index - step * direction;
    }

    next = Math.max(0, Math.min(pool.length - 1, next));
    index = next;
    notes.push({ midi: pool[index], duration: randomNoteDuration(false) });
  }

  return notes;
}

export class ExerciseGenerator {
  generate({ skillKey, clef, level, melodyOptions }: { skillKey: SkillKey; clef: Clef; level: number; melodyOptions?: MelodyOptions }): Exercise {
    switch (skillKey) {
      case 'note_naming':
        return this.generateNoteNaming(clef, level);
      case 'interval_visual':
        return this.generateIntervalVisual(clef, level);
      case 'rhythm_id':
        return this.generateRhythm(level, clef);
      case 'interval_aural':
        return this.generateIntervalAural(clef, level);
      case 'sing_note':
        return this.generateSingNote(clef, level);
      case 'sing_interval':
        return this.generateSingInterval(clef, level);
      case 'sing_melody':
        return this.generateSingMelody(clef, level, melodyOptions ?? DEFAULT_MELODY_OPTIONS);
      default:
        return this.generateNoteNaming(clef, level);
    }
  }

  private generateNoteNaming(clef: Clef, level: number): Exercise {
    const pool = getNaturalPool(clef, level);
    const midi = randomChoice(pool);
    const scientific = midiToScientific(midi);
    const letter = noteLetter(scientific) ?? 'C';

    return {
      id: createExerciseId('note_naming'),
      family: 'visual',
      skillKey: 'note_naming',
      level,
      clef,
      prompt: { type: 'note_naming', note: scientific },
      choices: buildDistractorChoices(letter, ['A', 'B', 'C', 'D', 'E', 'F', 'G'], 4),
      expectedAnswer: { answer: letter },
      metadata: {},
    };
  }

  private generateIntervalVisual(clef: Clef, level: number): Exercise {
    const pair = generateIntervalPair(clef, level);

    return {
      id: createExerciseId('interval_visual'),
      family: 'visual',
      skillKey: 'interval_visual',
      level,
      clef,
      prompt: {
        type: 'interval_visual',
        first: midiToScientific(pair.firstMidi),
        second: midiToScientific(pair.secondMidi),
      },
      choices: buildDistractorChoices(String(pair.intervalStep), Object.keys(INTERVAL_LABELS).map(String), 4),
      expectedAnswer: { answer: String(pair.intervalStep) },
      metadata: { label: INTERVAL_LABELS[pair.intervalStep] },
    };
  }

  private generateRhythm(level: number, clef: Clef): Exercise {
    const count = Math.max(2, Math.min(RHYTHM_PATTERNS.length, level + 1));
    const pool = [...RHYTHM_PATTERNS.slice(0, count)];
    const pattern: (typeof RHYTHM_PATTERNS)[number] = randomChoice(pool);

    return {
      id: createExerciseId('rhythm_id'),
      family: 'visual',
      skillKey: 'rhythm_id',
      level,
      clef,
      prompt: { type: 'rhythm_id', display: pattern.display },
      choices: buildDistractorChoices(pattern.key, RHYTHM_PATTERNS.map((item) => item.key), 4),
      expectedAnswer: { answer: pattern.key },
      metadata: {
        patternLabel: pattern.label,
        choiceLabels: Object.fromEntries(RHYTHM_PATTERNS.map((item) => [item.key, item.label])),
      },
    };
  }

  private generateIntervalAural(clef: Clef, level: number): Exercise {
    const pair = generateIntervalPair(clef, level);
    return {
      id: createExerciseId('interval_aural'),
      family: 'aural',
      skillKey: 'interval_aural',
      level,
      clef,
      prompt: {
        type: 'interval_aural',
        first: midiToScientific(pair.firstMidi),
        second: midiToScientific(pair.secondMidi),
      },
      choices: buildDistractorChoices(String(pair.intervalStep), Object.keys(INTERVAL_LABELS).map(String), 4),
      expectedAnswer: { answer: String(pair.intervalStep) },
      metadata: { label: INTERVAL_LABELS[pair.intervalStep] },
    };
  }

  private generateSingNote(clef: Clef, level: number): Exercise {
    const pool = getNaturalPool(clef, level);
    const midi = randomChoice(pool);
    const scientific = midiToScientific(midi);

    return {
      id: createExerciseId('sing_note'),
      family: 'singing',
      skillKey: 'sing_note',
      level,
      clef,
      prompt: { type: 'sing_note', target: scientific },
      choices: [],
      expectedAnswer: { targetMidi: midi },
      metadata: {},
    };
  }

  private generateSingInterval(clef: Clef, level: number): Exercise {
    const pair = generateIntervalPair(clef, level);
    const semitoneDist = Math.abs(pair.secondMidi - pair.firstMidi);
    const intervalLabel = INTERVAL_QUALITY_LABELS[semitoneDist] ?? INTERVAL_LABELS[pair.intervalStep] ?? String(pair.intervalStep);

    return {
      id: createExerciseId('sing_interval'),
      family: 'singing',
      skillKey: 'sing_interval',
      level,
      clef,
      prompt: {
        type: 'sing_interval',
        reference: midiToScientific(pair.firstMidi),
        target: midiToScientific(pair.secondMidi),
      },
      choices: [],
      expectedAnswer: { targetMidi: pair.secondMidi },
      metadata: {
        intervalStep: pair.intervalStep,
        intervalLabel,
      },
    };
  }

  private generateSingMelody(clef: Clef, level: number, options: MelodyOptions): Exercise {
    const rawNotes = generateMelodyNotes(clef, level, options);
    const melodyNotes: MelodyNote[] = rawNotes.map(({ midi, duration }) => ({
      pitch: midiToScientific(midi),
      duration,
    }));
    const melodyMidis = rawNotes.map(({ midi }) => midi);

    return {
      id: createExerciseId('sing_melody'),
      family: 'singing',
      skillKey: 'sing_melody',
      level,
      clef,
      prompt: {
        type: 'sing_melody',
        notes: melodyNotes,
      },
      choices: [],
      expectedAnswer: {
        targetMidis: melodyMidis,
        minAccuracy: Math.max(0.55, 0.8 - level * 0.04),
      },
      metadata: {
        melodyFirstNoteMode: options.firstNoteMode,
        melodyAllowedIntervalSteps: options.allowedIntervalSteps,
      },
    };
  }
}
