# Recording crashes with `AudioRecorder is not a constructor`

## Original issue
When pressing record in any singing exercise, recording crashed with:
`_expoAudio.AudioModule.AudioRecorder is not a constructor`
from `src/adapters/pitch/expo-pitch-capture-port.ts`.

## Root cause
- The adapter instantiated `new AudioModule.AudioRecorder(...)` directly.
- On web, `expo-audio` exposes `AudioRecorderWeb` instead of `AudioRecorder`, so the constructor lookup failed at runtime.

## Changes made
- Updated `mobile/src/adapters/pitch/expo-pitch-capture-port.ts`:
  - Added `createRecorder()` helper that resolves recorder constructor from `AudioModule.AudioRecorder` (native) or `AudioModule.AudioRecorderWeb` (web).
  - Added a clear fallback error if no recorder constructor is available.
  - Replaced direct constructor usage in `recordFor()` with `this.createRecorder()`.

## Validation
- `npm test` in `mobile/` (pass, 6 files / 15 tests)
