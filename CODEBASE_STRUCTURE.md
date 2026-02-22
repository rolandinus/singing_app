# Codebase Structure

## Root

- `singV3.html`: Main sight-singing app (dashboard, practice, settings).
- `singV2.html`: Legacy single-file singing trainer kept as reference.
- `scripts/dev-server.sh`: Lightweight local static server script.
- `DEV_SERVER.md`: Local server usage notes.
- `sw.js`: Service worker script.
- `span.html`, `nback.html`, `arithmetics.html`: Separate standalone pages.

## Main App (`singV3.html`)

### App Layer

- `src/js/main.js`
  - App bootstrap.
  - Instantiates `AppShell` after DOM is ready.

- `src/js/app/dom.js`
  - Central DOM element lookup for all screens.

- `src/js/app/app-shell.js`
  - Main coordinator.
  - Handles routing between dashboard/practice/settings, session lifecycle, progress updates, and persistence.

- `src/js/app/singing-trainer-app.js`
  - Older singing trainer controller (legacy module, not used by new shell).

### Domain Layer

- `src/js/domain/exercise-generator.js`
  - Generates visual, aural, and singing exercises by clef and level.

- `src/js/domain/exercise-evaluator.js`
  - Evaluates answers and singing pitch accuracy.

- `src/js/domain/progression-engine.js`
  - Mastery and level-up logic using rolling accuracy windows.

- `src/js/domain/session-planner.js`
  - Builds guided and custom exercise queues.

### Data Layer

- `src/js/data/settings-repository.js`
  - Reads/writes learner settings in local storage.

- `src/js/data/progress-repository.js`
  - Progress/session persistence via IndexedDB with localStorage fallback.

### UI Layer

- `src/js/ui/dashboard-view.js`
  - Dashboard summary, skill-map cards, recent sessions.

- `src/js/ui/practice-view.js`
  - Exercise rendering, choices, action button state, session progress UI.

- `src/js/ui/session-summary-view.js`
  - End-of-session summary panel.

- `src/js/ui/settings-view.js`
  - Settings form rendering and input extraction.

### Audio + Rendering + Utils

- `src/js/audio/ear-training-player.js`
  - Tone.js playback helpers for prompts and reference tones.

- `src/js/render/learning-staff.js`
  - Clef-aware staff/note rendering (treble + bass).

- `src/js/render/staff.js`
  - Legacy renderer used by old singing trainer module.

- `src/js/utils/pitch.js`
  - Autocorrelation pitch detection and MIDI/note conversion helpers.

- `src/js/utils/note-helpers.js`
  - Note/midi helper functions and generic random/choice utilities.

### Configuration

- `src/js/config/constants.js`
  - Shared SVG/music constants from legacy/refactored trainer work.

- `src/js/config/curriculum.js`
  - Curriculum definitions, skills, clef ranges, progression thresholds, defaults.

## Dependency Direction

`singV3.html` -> `src/js/main.js` -> `src/js/app/app-shell.js`

`app-shell` -> `domain`, `data`, `ui`, `audio`, `utils`, `render`

`domain` -> `config`, `utils`

`ui` -> `render`, `config`

## Notes

- `singV2.html` remains unchanged as historical reference.
- The new app is organized by responsibility: app/domain/data/ui/audio/render/utils/config.
