# Add Melody Generation Controls To Mobile Practice

## Summary
The mobile app can now generate and score `sing_melody` exercises, but it still does not expose the melody-shaping controls that exist in the browser trainer. Mobile custom practice only lets the user pick family, skill, clef, level, and count, so every melody is generated from fixed defaults. Add the missing melody-specific controls and pass them through the mobile session/generator stack so custom melody practice can be configured intentionally instead of relying on opaque generator behavior.

## Current State
`mobile/app/(tabs)/practice.tsx` renders a generic custom-session form with family, skill, clef, level, and count controls only. There is no conditional UI when `selectedSkill === 'sing_melody'`.

`mobile/src/core/domain/exercise-generator.ts` generates melody prompts from `generateMelodyMidis(clef, level)` and only returns `prompt.notes` plus `expectedAnswer.targetMidis`. There is no input path for browser-style melody options such as:

- first-note selection (`random`, `C2`, `C4`)
- allowed interval set
- generator metadata that preserves how the melody was constructed

The browser trainer exposes these controls directly in the practice UI before generating a melody in `singV3.html` and `src/js/app/singing-trainer-app.js`.

## Proposed Changes
- Add melody-specific configuration state to the mobile custom practice flow, shown only when the selected skill is `sing_melody`.
- Mirror the browser controls that affect melody content, including first-note mode with at least `random`, `C2`, and `C4`.
- Add allowed interval selection with validation that prevents an empty set.
- Extend the mobile types/store/session-start path so custom melody options travel from `mobile/app/(tabs)/practice.tsx` through `mobile/src/state/use-app-store.ts` and `mobile/src/core/services/session-service.ts` into the exercise generator.
- Update `mobile/src/core/domain/exercise-generator.ts` so `generateSingMelody` accepts these options and records the applied settings in `metadata`, making downstream UI/debugging deterministic.
- Add focused tests for custom melody generation to prove the generated prompt respects the selected first-note mode and allowed intervals.

## Acceptance Criteria
- When the user selects `sing_melody` in mobile custom practice, the UI exposes melody-specific generation controls instead of only the generic form fields.
- Starting a custom melody session uses the chosen first-note mode and interval whitelist when building each exercise.
- The app rejects invalid melody configuration, including an empty interval selection.
- Generated melody exercises carry enough metadata for the active exercise UI and tests to confirm which settings were applied.
- Automated tests cover the new generator/session wiring for melody-specific options.

## Notes
- This issue is intentionally limited to configuring what melody gets generated.
- Dedicated trainer parity during the active exercise itself, including timed playback/recording controls and recorded-note visualization, is tracked separately in `02_mobile_melody_trainer_parity.md`.
