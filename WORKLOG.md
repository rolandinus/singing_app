# Worklog

## 2026-02-28

### Firebase Test Lab stabilization
- Root cause in screenshots: Firebase Robo was running a debug APK (`Unable to load script` / Metro bundle missing).
- Fixed automation to build/use release APK for Firebase:
  - `scripts/android-build-debug-apk.sh` now assembles release.
  - `scripts/android-firebase-robo.sh` defaults to `app-release.apk`.
- Resolved Android startup crash in Test Lab by aligning Expo AV:
  - `mobile/package.json`: `expo-av` updated to `~16.0.8`.
  - `mobile/app.json`: `newArchEnabled` set to `false` for validated run path.

### Firebase runs
- Passing run observed:
  - Matrix: `matrix-1w58mriel8z6n`
  - Result: `Passed` (`redfin-30-en-portrait`)
  - Artifacts: `gs://test-lab-71jcsufrj144s-nybzr025w4pfk/2026-02-28_19:51:37.739346_nbVr/`
- Later rerun after melody work failed at validation due to quota:
  - Matrix: `matrix-1agftv9ouchof`
  - Error: `TEST_QUOTA_EXCEEDED`
  - Artifacts bucket path created: `gs://test-lab-71jcsufrj144s-nybzr025w4pfk/2026-02-28_20:34:04.681699_ibwH/`

### Mobile parity progress
- Singing melody recording is now implemented in RN:
  - Melody exercise generation includes target note sequence (`targetMidis`).
  - Melody prompt playback is supported.
  - Melody recording captures pitch contour and evaluates melody accuracy.
  - Practice UI now includes `sing_melody` in custom sessions.
- Tests updated and passing (`mobile`: 6 files, 11 tests).

### Relevant commits
- `e6d2d81` android: use release APK for Firebase Robo runs
- `138315e` mobile: fix Android startup crash in Firebase Test Lab
- `4644aa7` mobile: add singing melody recording flow
- `df3007d` docs: mark melody recording as implemented in mobile
