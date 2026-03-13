# Replace native pitch capture with real-time mic streaming

## Problem

The current native pitch detection uses a **record-then-playback** workaround:

1. `AudioRecorder` records the user's singing to a local file for `durationMs`
2. The file is played back via `AudioPlayer` with `setAudioSamplingEnabled(true)`
3. `audioSampleUpdate` events fire during playback, delivering PCM frames for analysis
4. Autocorrelation runs on those frames to extract frequency

This has several serious UX problems:

- **No live feedback** — pitch data is unavailable during the recording phase; the user must wait for the full recording to finish before seeing any result
- **Double the wait time** — total latency is roughly `2 × durationMs` (record + replay) before results appear
- **Accidental playback** — the user hears their own voice played back through the speaker during the analysis phase, which is confusing
- **Not fixable within `expo-audio`** — `audioSampleUpdate` is a player-only API. The recorder emits only metering scalars, not PCM frames. `VOICE_PERFORMANCE` mode (Android) only selects a lower-latency audio source; it does not unlock PCM streaming from the recorder.

## Solution: `@siteed/expo-audio-studio`

Replace the record-then-playback path with real-time PCM callbacks using [`@siteed/expo-audio-studio`](https://www.npmjs.com/package/@siteed/expo-audio-studio).

The package provides an `onAudioStream` callback that fires at a configurable interval with raw PCM data from the microphone — the same principle as the Web Audio API `AnalyserNode` approach already used on web.

### Key capabilities

| Property | Value |
|---|---|
| Platforms | iOS, Android, Web |
| Sample rates | 16000 / 44100 / 48000 Hz |
| Encoding | `pcm_16bit` / `pcm_32bit` (all platforms) |
| Min interval | ~10 ms (iOS/Android); ~46 ms recommended for 2048-sample windows at 44100 Hz |
| PCM format (native) | base64-encoded string; `convertPCMToFloat32` utility included |
| Maintenance | Active — v2.18.6, published March 2025 |
| Workflow requirement | **Bare workflow** (`npx expo prebuild`) |

### Integration sketch

```ts
import { startRecording, stopRecording, convertPCMToFloat32 } from '@siteed/expo-audio-studio';

await startRecording({
  sampleRate: 44100,
  encoding: 'pcm_16bit',
  channels: 1,
  interval: 46,           // ~2028 samples per callback at 44100 Hz
  onAudioStream: async ({ data }) => {
    // data is base64 on native, Float32Array on web
    const pcm = convertPCMToFloat32(data as string, 16);
    const hz = autoCorrelate(pcm, 44100);
    if (hz > 60 && hz < 1200) {
      // push to timeline / update UI in real time
    }
  },
});
```

### Changes required

- **`mobile/src/adapters/pitch/expo-pitch-capture-port.ts`** — replace `recordFor` + `analyzeRecording` native path with a streaming approach using `@siteed/expo-audio-studio`. Gate on `Platform.OS !== 'web'` (web already works via `AnalyserNode`). Consider unifying web + native under one API surface since the package also supports web.
- **`mobile/package.json`** — add `@siteed/expo-audio-studio`
- **`mobile/app.json`** — add the Expo plugin entry for `@siteed/expo-audio-studio`
- Run `npx expo prebuild` to generate native build artifacts

### Known caveats

- GitHub issue #296: `onAudioStream` callback not firing in some cases — test on target Android API level early
- Base64 decode overhead on native: budget ~1–2 ms per frame at 2048 samples
- The package has a built-in `pitch` feature flag (`AudioFeaturesOptions`) but it is marked **experimental** — see TODO below

## TODO

- [ ] Evaluate `@siteed/expo-audio-studio`'s built-in pitch feature and compare accuracy and performance with the current `autoCorrelate` implementation (see TODO.md)
