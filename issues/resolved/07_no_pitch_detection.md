# Pitch detection always returns "Keine stabile Tonhöhe erkannt" on web

## Original issue
Pitch detection did not work in all singing exercises in the mobile app web endpoint.
Feedback always returned: `Keine stabile Tonhöhe erkannt`.

## Root cause
- The mobile pitch adapter used deprecated `expo-av` recording/playback APIs.
- On web, this path did not deliver reliable sample data for analysis, so frequency timelines stayed empty and every singing evaluation became `no_pitch`.

## Changes made
- Migrated recording and analysis in `mobile/src/adapters/pitch/expo-pitch-capture-port.ts` from `expo-av` to the new `expo-audio` API:
  - recording permissions via `getRecordingPermissionsAsync()` / `requestRecordingPermissionsAsync()`
  - recorder via `new AudioModule.AudioRecorder(...)` + `prepareToRecordAsync()` + `record()` + `stop()`
  - playback analysis via `createAudioPlayer(...)` + `audioSampleUpdate` listener
  - audio mode configuration via `setAudioModeAsync(...)`
- Added web polyfill bootstrap in `mobile/src/polyfills/audio-recorder-polyfill.ts` and imported it in `mobile/app/_layout.tsx` so web recorder support follows Expo’s documented polyfill path.
- Installed dependencies:
  - `expo-audio`
  - `audio-recorder-polyfill`

## Legacy comparison
- Kept the same core autocorrelation logic and frequency filtering approach used in the legacy browser flow.
- Removed the temporary manual WebAudio fallback path; implementation now uses Expo components only.

## Validation
- `npx tsc --noEmit` (pass)
- `npm test` (pass, 6 files / 15 tests)
