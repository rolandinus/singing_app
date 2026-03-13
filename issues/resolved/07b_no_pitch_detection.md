# 07b - Pitch detection debugging view

## Original request
Pitch detection is not working in the mobile app.  
Add a debugging view, with live information of data received from the microphone.

## Outcome
resolved

## Work completed
- Added live debug snapshots in `ExpoPitchCapturePort` for microphone capture and pitch analysis phases.
- Enabled recorder metering (`isMeteringEnabled`) and emitted live recording data (`durationMillis`, `metering`, `isRecording`) while recording is active.
- Emitted ongoing analysis samples (`frequency`, `timelinePoints`) and completion snapshots from pitch analysis.
- Added a service hook (`setPitchDebugListener`) and wired it through Zustand state so debug data is available in the UI.
- Added a singing-only debug panel on the practice screen to show live microphone/debug values:
  - capture phase
  - recording duration (ms)
  - input level (dB metering)
  - latest detected frequency (Hz)
  - analysis points
  - last update timestamp
- Added localization keys for debug labels in German and English.

## Validation
- `npm test` (Vitest) passed.
- `npx tsc --noEmit` passed.
