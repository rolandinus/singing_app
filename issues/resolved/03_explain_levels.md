## Resolved

- The issue file was empty, so the implementation was inferred from its filename: the app showed `L1`-style levels and mastery percentages without explaining them.
- Added a reusable progress explainer card to the dashboard skill map and the session summary.
- The explainer is driven by the real progression constants, so it reflects the current rules for max level, rolling mastery window, and level-up threshold.

## Validation

- `npm test -- --run src/tests/translator.test.ts`
- `npm test`
