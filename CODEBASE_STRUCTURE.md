# Codebase Structure

## Root

- `singV3.html`: Main browser sight-singing app (dashboard, practice, settings).
- `singV2.html`: Legacy single-file singing trainer kept as reference.
- `src/js/`: Browser app source code (modular JS architecture). - legacy we now work no the mobile app in /mobile
- `mobile/`: Expo React Native app (active migration target).
- `scripts/dev-server.sh`: Lightweight local static server script for browser app.
- `DEV_SERVER.md`: Local server usage notes.


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
- Mobile now supports visual + aural + singing flows in RN UI, including melody capture/recording (`sing_melody`).
