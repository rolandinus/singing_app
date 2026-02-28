# Codebase Structure

## Root

- `singV3.html`: Main browser sight-singing app (dashboard, practice, settings).
- `singV2.html`: Legacy single-file singing trainer kept as reference.
- `src/js/`: Browser app source code (modular JS architecture).
- `mobile/`: Expo React Native app (active migration target).
- `scripts/dev-server.sh`: Lightweight local static server script for browser app.
- `DEV_SERVER.md`: Local server usage notes.

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

## Mobile App (`mobile/`)

### App Shell + Navigation (Expo Router)

- `mobile/app/_layout.tsx`
  - Stack layout and localized route titles.

- `mobile/app/index.tsx`
  - Dashboard screen (guided start, recent sessions, visual skill map).

- `mobile/app/practice.tsx`
  - Practice screen (custom setup + active session flow for visual skills).

- `mobile/app/settings.tsx`
  - Settings screen (clefs, daily goal, locale).

- `mobile/app/summary.tsx`
  - End-of-session summary screen.

### Core Domain + Services

- `mobile/src/core/domain/`
  - `exercise-generator.ts`, `exercise-evaluator.ts`, `progression-engine.ts`, `session-planner.ts`.
  - Mobile TypeScript equivalents of browser domain logic.

- `mobile/src/core/services/session-service.ts`
  - Session orchestration for guided/custom sessions.
  - Integrates generation, evaluation, progression, persistence.

- `mobile/src/core/types.ts`
  - Shared application/domain type definitions.

- `mobile/src/core/config/`
  - `curriculum.ts`, `constants.ts`.

- `mobile/src/core/utils/note-helpers.ts`
  - Shared note/random helper utilities.

### Localization + State + Persistence

- `mobile/src/core/i18n/translator.ts`
  - Bilingual translation layer (German default, English supported).

- `mobile/src/state/use-app-store.ts`
  - Zustand store for UI/session state and actions.

- `mobile/src/adapters/storage/async-storage-port.ts`
  - AsyncStorage persistence adapter for settings/progress/session history.

### UI + Rendering

- `mobile/src/ui/components/`
  - `Screen.tsx`, `Card.tsx`, `StaffSvg.tsx` reusable RN UI primitives.

- `mobile/src/core/render/`
  - Staff model and React Native SVG rendering helpers.

### Tests + QA

- `mobile/src/tests/`
  - Domain/service/i18n tests (`vitest`).

- `mobile/docs/ANDROID_QA_CHECKLIST.md`
  - Manual Android validation checklist.

- `mobile/docs/ANDROID_QA_REPORT.md`
  - Current QA report and execution status.

### Tooling

- `mobile/package.json`: Expo app scripts + dependencies.
- `mobile/tsconfig.json`: TypeScript config.
- `mobile/vitest.config.ts`: Test config.

## Dependency Direction

### Browser

`singV3.html` -> `src/js/main.js` -> `src/js/app/app-shell.js` -> `domain` + `data` + `ui` + `adapters/ports` + `audio` + `render` + `utils`

### Mobile

`mobile/app/*.tsx` -> `mobile/src/state/use-app-store.ts` -> `mobile/src/core/services/session-service.ts` -> `mobile/src/core/domain/*` + `mobile/src/adapters/storage/async-storage-port.ts`

`mobile/app/*.tsx` -> `mobile/src/core/i18n/translator.ts` for screen copy and labels

## Notes

- Browser app and mobile app currently coexist during migration.
- Mobile Phase 2 scope is visual training parity first; aural/singing flows are deferred in the RN UI.
