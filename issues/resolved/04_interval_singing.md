# 04 interval singing

## Request
- On interval singing always play the first note.
- For the interval name do not just say e.g. "kleine Terz", but e.g. "kleine Terz nach oben".

## Outcome
resolved

## Work done
- Updated sing-interval generation to append direction to the interval label (`nach oben` / `nach unten` / `auf gleicher Höhe`).
- Updated singing capture flow to always play the sing-interval reference note before recording evaluation starts.
- Added practice-screen behavior to auto-play the reference note once when each new `sing_interval` exercise appears.
- Added tests for directional interval labels and reference-note-before-capture behavior.

## Validation
- `npm run typecheck` (in `mobile/`)
- `npm test` (in `mobile/`)
