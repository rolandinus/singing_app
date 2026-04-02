# Patches to `@siteed/expo-audio-studio` native Android code

These are **direct edits to `node_modules`** — they are not tracked by the package
manager and will be lost on `npm install`. This document records what was changed,
why, and what the options are for making the changes permanent.

---

## Affected files

| File | Nature of change |
|---|---|
| `android/src/main/java/net/siteed/audiostream/AudioProcessor.kt` | Full replacement of `estimatePitch()` |

---

## Change 1 — `AudioProcessor.kt`: replace `estimatePitch()`

### Root cause discovered

During debugging, logcat revealed that every call to `estimatePitch` threw a
silently-caught exception:

```
FFT inverse transform failed: length=4096; index=4096
```

The original implementation used the custom `FFT` class defined in `FFT.kt`.
`FFT.realInverse()` creates an intermediate array of size `n * 2` and then calls
`realForward()` on it. `realForward` is a recursive Cooley–Tukey implementation
whose butterfly loop indexes `cosTable`, which is sized for `n` — not `2n`. At
runtime this produces an `ArrayIndexOutOfBoundsException` at the first butterfly
pass for the doubled array, which the `try/catch` in `estimatePitch` absorbs,
returning `0.0f` for every single segment. Pitch detection was therefore
completely non-functional.

Additionally, even if the FFT had been correct, the original algorithm capped the
detectable pitch range at **50–500 Hz** (hard-coded `sampleRate / 500.0f` as the
minimum lag), which silently discards all notes above **B4 (~494 Hz)** — a large
portion of the singing range.

### What the original code did

```kotlin
// ORIGINAL (broken)
private fun estimatePitch(segment: FloatArray, sampleRate: Float): Float {
    // ... Hann window, FFT pad ...
    val fft = FFT(fftLength)
    fft.realForward(padded)                            // forward FFT
    // build powerSpectrum ...
    fft.realInverse(powerSpectrum, autocorrelation)    // ← always throws; returns 0.0f
    // normalise, find peak in 50–500 Hz range with threshold 0.3 ...
}
```

### What the replacement does

The broken FFT path was removed entirely and replaced with a straightforward
**time-domain normalized autocorrelation**, mirroring the approach already used
by the JavaScript `autoCorrelate` function in
`src/core/utils/pitch.ts` (which works correctly for real-time pitch detection):

```kotlin
// REPLACEMENT
private fun estimatePitch(segment: FloatArray, sampleRate: Float): Float {
    val n = segment.size
    if (n < 256) return 0.0f

    // Silence gate: RMS < 0.01 → skip
    var sumSq = 0f
    for (s in segment) sumSq += s * s
    if (sqrt(sumSq / n) < 0.01f) return 0.0f

    // Search range: 60 Hz (C2) to 1200 Hz (C6) — full singing range
    val minLag = (sampleRate / 1200.0f).toInt().coerceAtLeast(1)
    val maxLag = (sampleRate / 60.0f).toInt().coerceAtMost(n / 2)
    if (maxLag <= minLag) return 0.0f

    // Normalized autocorrelation: r(lag) / r(0)
    val r0 = sumSq
    var bestCorr = 0.1f   // minimum accepted correlation (threshold)
    var bestLag = 0

    for (lag in minLag..maxLag) {
        var r = 0f
        val len = n - lag
        for (i in 0 until len) r += segment[i] * segment[i + lag]
        val norm = r / r0
        if (norm > bestCorr) { bestCorr = norm; bestLag = lag }
    }

    val result = if (bestLag > 0) sampleRate / bestLag else 0.0f
    LogUtils.d(CLASS_NAME, "[estimatePitch:v2] segmentSize=$n maxCorr=$bestCorr lag=$bestLag result=$result")
    return result
}
```

Key parameter choices (deliberately permissive for testing):

| Parameter | Original | Replacement | Reason |
|---|---|---|---|
| Min detectable Hz | 50 | **60** | C2, lowest practical singing note |
| Max detectable Hz | **500** (B4) | **1200** (D6) | Cover full soprano range |
| Correlation threshold | **0.3** | **0.1** | Emulator audio quality is poor; lower threshold lets more frames through |
| Algorithm | FFT autocorrelation (broken) | **Time-domain autocorrelation** | Correct, no dependencies |

The `LogUtils.d` call tagged `[estimatePitch:v2]` was added intentionally to
confirm in logcat that the patched code is compiled in (not a cached pre-built
AAR).

### Performance note

Time-domain autocorrelation is O(n × L) where L is the lag range (minLag to
maxLag). For a 44100 Hz recording analysed in 80 ms segments:

- n ≈ 3528 samples
- L ≈ 700 lags (lag 37 to 735)
- ≈ 2.5 M multiply-adds per segment

This runs acceptably for post-recording analysis. For **real-time** analysis
(46 ms intervals during recording), the same code runs per audio chunk, which
may be slow on low-end devices — the threshold of 0.1 may also produce more
false-positive detections. Both threshold and algorithm should be revisited
before any production use.

---

## Why this hasn't been upstreamed

- The bug is in a third-party package (`@siteed/expo-audio-studio`). Upstreaming
  requires a fork or a PR to the original repository.
- The replacement algorithm and parameters are tuned for **testing** and have not
  been validated for production quality.

---

## Options for making this permanent

### Option A — `patch-package`

Install `patch-package`, run `npx patch-package @siteed/expo-audio-studio`, and
commit the generated `.patch` file to the repo. The patch is re-applied
automatically on `npm install` via a `postinstall` script.

**Pros:** Lightweight, no fork needed, diff is auditable.  
**Cons:** Patch breaks if the upstream package upgrades and changes the same lines.

### Option B — Fork the repository

Fork `https://github.com/deeeed/expo-audio-stream` and point `package.json` at
the fork (GitHub URL or private registry). Apply the changes there.

**Pros:** Full control, can also fix `FFT.kt` properly or replace with a real FFT
library, can submit upstream PR.  
**Cons:** Fork maintenance burden; need to keep up with upstream updates.

### Option C — Replace native pitch with JS-only path

Remove the dependency on the native `estimatePitch` entirely. After recording,
post-process the saved WAV file in JavaScript using the existing `autoCorrelate`
implementation (which already works). The `analyzeWavPitch` method added to
`ExpoPitchCapturePort` is the entry point for this approach.

**Pros:** No native patches needed; consistent with the real-time JS detector.  
**Cons:** Requires reading and decoding the WAV file in JS; `extractAudioAnalysis`
would only be used for non-pitch features (RMS, ZCR, etc.).

### Option D — Upstream a proper fix

File a bug report / PR against `expo-audio-stream` with the `FFT.realInverse` bug
and the 500 Hz pitch ceiling. The package is actively maintained.

---

## Recommendation (deferred)

For the immediate testing phase, **Option A (`patch-package`)** is the least
effort path to make the node_modules edit survive `npm install`. The algorithm
and thresholds should be revisited before deciding between B and C for the
longer term.
