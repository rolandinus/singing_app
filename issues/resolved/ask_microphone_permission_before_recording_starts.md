# Ask microphone permission before recording starts

## Outcome
resolved

## Implemented
- Added explicit microphone-permission preflight to the pitch capture adapter via `ensureMicrophonePermission()`.
- Enforced permission preflight at the start of `SessionService.captureSingingAttempt()` for all singing exercises.
- This guarantees melody count-in and recording do not start before permission is granted.
- If permission is denied, recording is not attempted.
- Added store-level error handling in `use-app-store` so denied permission surfaces as user feedback instead of an unhandled exception.

## Validation
- `cd mobile && npm run typecheck`
- `cd mobile && npm test`
- Added/updated test in `src/tests/melody-trainer.test.ts` to verify permission preflight occurs before count-in and capture.
