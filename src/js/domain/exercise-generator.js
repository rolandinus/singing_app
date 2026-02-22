import {
  CLEF_NOTE_RANGES,
  INTERVAL_LABELS,
  RHYTHM_PATTERNS,
} from "../config/curriculum.js";
import {
  buildDistractorChoices,
  getNaturalMidiPool,
  midiToScientific,
  noteLetter,
  randomChoice,
} from "../utils/note-helpers.js";

function createExerciseId(skillKey) {
  return `${skillKey}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function getIntervalStepsForLevel(level) {
  if (level <= 1) return [1, 2, 3];
  if (level === 2) return [1, 2, 3, 4];
  if (level === 3) return [1, 2, 3, 4, 5];
  if (level === 4) return [1, 2, 3, 4, 5, 6, 7];
  return [1, 2, 3, 4, 5, 6, 7, 8];
}

function getLevelRange(clef, level) {
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
  };

  const table = expansions[clef] ?? expansions.treble;
  const boundedLevel = Math.max(1, Math.min(table.length, level));
  const selected = table[boundedLevel - 1];

  return {
    minMidi: Math.max(base.minMidi, selected.min),
    maxMidi: Math.min(base.maxMidi, selected.max),
  };
}

function getNaturalPool(clef, level) {
  const range = getLevelRange(clef, level);
  const pool = getNaturalMidiPool(range.minMidi, range.maxMidi);

  if (pool.length === 0) {
    return getNaturalMidiPool(CLEF_NOTE_RANGES[clef].minMidi, CLEF_NOTE_RANGES[clef].maxMidi);
  }

  return pool;
}

function generateIntervalPair(clef, level) {
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

export class ExerciseGenerator {
  generate({ skillKey, clef, level }) {
    switch (skillKey) {
      case "note_naming":
        return this.#generateNoteNaming(clef, level);
      case "interval_visual":
        return this.#generateIntervalVisual(clef, level);
      case "rhythm_id":
        return this.#generateRhythm(level, clef);
      case "interval_aural":
        return this.#generateIntervalAural(clef, level);
      case "sing_note":
        return this.#generateSingNote(clef, level);
      case "sing_interval":
        return this.#generateSingInterval(clef, level);
      case "sing_melody":
        return this.#generateSingMelody(clef, level);
      default:
        return this.#generateNoteNaming(clef, level);
    }
  }

  #generateNoteNaming(clef, level) {
    const pool = getNaturalPool(clef, level);
    const midi = randomChoice(pool);
    const scientific = midiToScientific(midi);
    const letter = noteLetter(scientific);

    return {
      id: createExerciseId("note_naming"),
      family: "visual",
      skillKey: "note_naming",
      level,
      clef,
      prompt: {
        type: "note_naming",
        note: scientific,
      },
      choices: buildDistractorChoices(letter, ["A", "B", "C", "D", "E", "F", "G"], 4),
      expectedAnswer: {
        answer: letter,
      },
      metadata: {},
    };
  }

  #generateIntervalVisual(clef, level) {
    const pair = generateIntervalPair(clef, level);

    return {
      id: createExerciseId("interval_visual"),
      family: "visual",
      skillKey: "interval_visual",
      level,
      clef,
      prompt: {
        type: "interval_visual",
        first: midiToScientific(pair.firstMidi),
        second: midiToScientific(pair.secondMidi),
      },
      choices: buildDistractorChoices(
        String(pair.intervalStep),
        Object.keys(INTERVAL_LABELS),
        4,
      ),
      expectedAnswer: {
        answer: String(pair.intervalStep),
      },
      metadata: {
        label: INTERVAL_LABELS[pair.intervalStep],
      },
    };
  }

  #generateRhythm(level, clef) {
    const count = Math.max(2, Math.min(RHYTHM_PATTERNS.length, level + 1));
    const pool = RHYTHM_PATTERNS.slice(0, count);
    const pattern = randomChoice(pool);

    return {
      id: createExerciseId("rhythm_id"),
      family: "visual",
      skillKey: "rhythm_id",
      level,
      clef,
      prompt: {
        type: "rhythm_id",
        display: pattern.display,
      },
      choices: buildDistractorChoices(pattern.key, RHYTHM_PATTERNS.map((item) => item.key), 4),
      expectedAnswer: {
        answer: pattern.key,
      },
      metadata: {
        patternLabel: pattern.label,
        choiceLabels: Object.fromEntries(RHYTHM_PATTERNS.map((item) => [item.key, item.label])),
      },
    };
  }

  #generateIntervalAural(clef, level) {
    const pair = generateIntervalPair(clef, level);

    return {
      id: createExerciseId("interval_aural"),
      family: "aural",
      skillKey: "interval_aural",
      level,
      clef,
      prompt: {
        type: "interval_aural",
        first: midiToScientific(pair.firstMidi),
        second: midiToScientific(pair.secondMidi),
      },
      choices: buildDistractorChoices(String(pair.intervalStep), Object.keys(INTERVAL_LABELS), 4),
      expectedAnswer: {
        answer: String(pair.intervalStep),
      },
      metadata: {
        label: INTERVAL_LABELS[pair.intervalStep],
      },
    };
  }

  #generateSingNote(clef, level) {
    const pool = getNaturalPool(clef, level);
    const midi = randomChoice(pool);
    const scientific = midiToScientific(midi);

    return {
      id: createExerciseId("sing_note"),
      family: "singing",
      skillKey: "sing_note",
      level,
      clef,
      prompt: {
        type: "sing_note",
        target: scientific,
      },
      choices: [],
      expectedAnswer: {
        targetMidi: midi,
      },
      metadata: {},
    };
  }

  #generateSingInterval(clef, level) {
    const pair = generateIntervalPair(clef, level);

    return {
      id: createExerciseId("sing_interval"),
      family: "singing",
      skillKey: "sing_interval",
      level,
      clef,
      prompt: {
        type: "sing_interval",
        reference: midiToScientific(pair.firstMidi),
        target: midiToScientific(pair.secondMidi),
      },
      choices: [],
      expectedAnswer: {
        targetMidi: pair.secondMidi,
      },
      metadata: {
        intervalStep: pair.intervalStep,
      },
    };
  }

  #generateSingMelody(clef, level) {
    const melodyClef = "bass";

    return {
      id: createExerciseId("sing_melody"),
      family: "singing",
      skillKey: "sing_melody",
      level,
      clef: melodyClef,
      prompt: {
        type: "sing_melody",
        instruction: "Singe die generierte Melodie nach dem Einzähler.",
      },
      choices: [],
      expectedAnswer: {
        minAccuracy: Math.max(0.55, 0.8 - level * 0.04),
      },
      metadata: {},
    };
  }
}
