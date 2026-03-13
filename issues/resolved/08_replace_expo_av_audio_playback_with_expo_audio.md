# Replace Deprecated expo-av Audio Playback With expo-audio

## Summary
The mobile app still uses `expo-av` for prompt playback even though the project is already on Expo SDK 54 and already depends on `expo-audio`. Expo deprecated `expo-av` in SDK 53, recommends `expo-audio` / `expo-video` instead, and plans to remove `expo-av` in SDK 55. This issue should migrate the remaining playback path off `expo-av` so the app is aligned with the supported Expo audio stack before the next SDK upgrade.

## Current State
The project declares `expo-av` in [`mobile/package.json`](/home/roland/PhpstormProjects/singingApp/mobile/package.json) and configures it in [`mobile/app.json`](/home/roland/PhpstormProjects/singingApp/mobile/app.json).

Prompt playback in [`mobile/src/adapters/audio/expo-audio-prompt-port.ts`](/home/roland/PhpstormProjects/singingApp/mobile/src/adapters/audio/expo-audio-prompt-port.ts) imports `Audio`, `InterruptionModeAndroid`, and `InterruptionModeIOS` from `expo-av`, configures audio mode through `Audio.setAudioModeAsync`, and plays generated WAV data through `Audio.Sound.createAsync`.

The app already uses `expo-audio` for microphone capture and analysis in [`mobile/src/adapters/pitch/expo-pitch-capture-port.ts`](/home/roland/PhpstormProjects/singingApp/mobile/src/adapters/pitch/expo-pitch-capture-port.ts), so audio responsibilities are currently split across the deprecated and replacement packages.

## Proposed Changes
- Remove the `expo-av` dependency and its config plugin usage from the mobile app once replacement behavior is in place.
- Rework `ExpoAudioPromptPort` to use `expo-audio` playback APIs instead of `Audio.Sound`.
- Replace the current audio mode setup with the supported `expo-audio` equivalent while preserving silent-mode playback and ducking behavior where supported.
- Verify that note, interval, reference-target, and melody playback still work on Android, iOS, and web if those platforms are expected to remain supported.
- Confirm that microphone permission text remains correctly configured after removing the old plugin.

## Acceptance Criteria
- No runtime imports from `expo-av` remain in the mobile app.
- `mobile/package.json` and Expo config no longer reference `expo-av`.
- Prompt playback behavior remains functional for note, interval, and melody exercises.
- Audio mode configuration uses supported `expo-audio` APIs.
- The app remains buildable on Expo SDK 54 without relying on deprecated AV APIs.

## Notes
- Expo deprecated `expo-av` in SDK 53 and documents removal in SDK 55, so this is upgrade-readiness work rather than optional cleanup.
- The existing pitch capture implementation in `expo-audio` can serve as the local reference for API style and capability boundaries.
- This issue should not change exercise logic; it is a library migration around audio playback infrastructure.
