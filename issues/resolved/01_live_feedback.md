For the singing app add a live feedback. On the main staff display the note which is currently detected in red if it deviates from the correct note.

## Resolved

- Added shared live singing feedback helpers to convert pitch samples into detected scientific notes and compare them against the active singing target.
- Updated the shared staff renderer so it can overlay a detected note in red at the active target slot without disturbing the base prompt notation.
- Wired the practice singing staff and the melody trainer target staff to show the live detected note in red only when the current pitch differs from the expected note being sung.
- Added unit tests for live note detection and target-slot selection.

## Validation

- `npm test` in `mobile/` passed with 55/55 tests green.
