# 01 default clef

## Request
When user does not select a cleff in melody singing it always defaults to violin cleff, even if default in settings is bass or violin is disabled.

## Outcome
resolved

## Work done
- Updated `mobile/src/state/use-app-store.ts` to compute an effective clef from current settings before starting a custom session.
- `startCustom` now uses this normalized clef instead of trusting stale UI state.
- `saveSettings` now synchronizes `selectedClef` when `defaultClef` or `enabledClefs` changes, preventing hidden invalid selections (like treble when disabled).

## Validation
- `npm run typecheck` (in `mobile/`)
- `npm test` (in `mobile/`)
