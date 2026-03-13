# TODO

## Audio / Pitch Detection

- [ ] **Evaluate `@siteed/expo-audio-studio` built-in pitch feature** (see issue 12)
  - The package exposes a `pitch` flag in `AudioFeaturesOptions` that returns a Hz scalar per interval
  - It is explicitly marked experimental in the source
  - Compare against the current `autoCorrelate()` implementation:
    - Accuracy across the singing range (60–1200 Hz)
    - Latency per frame
    - CPU impact (the library warns about high processing requirements for spectral features)
  - If accurate enough, it could replace the custom JS autocorrelation and reduce bundle complexity
  - If not, keep `autoCorrelate()` / YIN fed from raw PCM via `onAudioStream`

## Advanced audio library
https://siteed.net/projects/react-native-essentia
https://essentia.upf.edu/