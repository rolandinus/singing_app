## Browser App (`singV3.html`)

### App Layer

- `src/js/main.js`
    - Browser bootstrap.
    - Instantiates `AppShell` after DOM is ready.

- `src/js/app/dom.js`
    - Central DOM element lookup for all browser screens.

- `src/js/app/app-shell.js`
    - Main browser coordinator.
    - Handles dashboard/practice/settings routing, session lifecycle, progress updates, and persistence.

- `src/js/app/session-service.js`
    - Browser-oriented session orchestration that connects ports/adapters to domain logic.

- `src/js/app/singing-trainer-app.js`
    - Older singing trainer controller (legacy module, not used by the new shell flow).

### Domain Layer

- `src/js/domain/exercise-generator.js`
    - Generates visual, aural, and singing exercises by clef and level.

- `src/js/domain/exercise-evaluator.js`
    - Evaluates answers and singing pitch accuracy.

- `src/js/domain/progression-engine.js`
    - Mastery and level-up logic using rolling accuracy windows.

- `src/js/domain/session-planner.js`
    - Builds guided and custom exercise queues.

### Data + Ports + Adapters

- `src/js/data/settings-repository.js`
    - Reads/writes learner settings in local storage.

- `src/js/data/progress-repository.js`
    - Progress/session persistence via IndexedDB with localStorage fallback.

- `src/js/ports/`
    - Port interfaces for storage, audio prompts, and pitch capture.

- `src/js/adapters/`
    - Browser implementations of the above ports.

### UI + Audio + Rendering + Utils

- `src/js/ui/dashboard-view.js`
    - Dashboard summary, skill-map cards, recent sessions.

- `src/js/ui/practice-view.js`
    - Exercise rendering, choices, action states, and session progress UI.

- `src/js/ui/session-summary-view.js`
    - End-of-session summary panel.

- `src/js/ui/settings-view.js`
    - Settings form rendering and input extraction.

- `src/js/audio/ear-training-player.js`
    - Tone.js playback helpers for prompts and reference tones.

- `src/js/render/learning-staff.js`
    - Clef-aware staff/note rendering (treble + bass) for browser DOM/SVG.

- `src/js/render/staff.js`
    - Legacy renderer used by old singing trainer module.

- `src/js/render/staff-model.js`, `src/js/render/svg-dom-renderer.js`, `src/js/render/rn-svg-renderer.js`
    - Newer shared/portable staff model and renderer adapters (browser + RN-oriented renderer module).

- `src/js/utils/pitch.js`
    - Autocorrelation pitch detection and MIDI/note conversion helpers.

- `src/js/utils/note-helpers.js`
    - Note/midi helper functions and generic random/choice utilities.

### Configuration

- `src/js/config/constants.js`
    - Shared SVG/music constants.

- `src/js/config/curriculum.js`
    - Curriculum definitions, skills, clef ranges, progression thresholds, defaults.
