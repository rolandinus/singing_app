# 02 redesign tone singing exercise

## Request
For the single tone exercise, change as follow:
- Keep recording, give live feedback (red note where the user sings, with an arrow up/down depending where the user needs to go with his voice)
- As soon as the user hits the note within tolerance for a full note duration (median note detection), display a big green checkmark.
- Then automatically load the next exercise, but dont start record.
- Use melody singing as a reference for live feedback.

## Outcome
resolved

## Work done
- Added continuous sing-note sampling in `SessionService.captureSingingAttempt` via windowed capture (`continuousSingNote`) until in-tune detection or safety cap.
- Updated store capture flow for `sing_note` to use note-duration windows, show success state, and auto-advance after a short checkmark delay.
- Extended live feedback model with `correctionDirection` (`up`/`down`) and wired it into staff rendering.
- Enhanced `StaffSvg` to draw directional arrow indicators near the live detected red note overlay.
- Added a large green checkmark UI state in practice screen during auto-advance.
- Added/updated tests for live feedback shape and continuous sing-note sampling.

## Validation
- `npm run typecheck` (in `mobile/`)
- `npm test` (in `mobile/`)
