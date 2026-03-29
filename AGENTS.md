read README.md
read CODEBASE_STRUCTURE.md
read WORKLOG.md

## Android automation defaults

- Prefer Firebase Test Lab over local Android emulator when host virtualization is unavailable.
- Primary end-to-end command:
  - `FIREBASE_PROJECT_ID=singing-app-56f72 npm run android:test:firebase:robo:build`
- If APK is already built:
  - `FIREBASE_PROJECT_ID=singing-app-56f72 npm run android:test:firebase:robo`
- APK build only:
  - `npm run android:build:apk`

## Firebase prerequisites

- `gcloud` installed and authenticated.
- Active project set (`gcloud config set project singing-app-56f72`).
- APIs enabled:
  - `testing.googleapis.com`
  - `toolresults.googleapis.com`

## Reference docs

- Android automation details: `mobile/docs/ANDROID_AUTOMATION.md`

## Critical reminders

- Firebase Robo must run a release APK, not debug (debug fails in Test Lab without Metro).
- If Firebase matrix creation fails with `TEST_QUOTA_EXCEEDED`, stop reruns and report quota block.
- Mobile singing scope now includes `sing_melody` recording/evaluation.
- Do atomic commits but do not push unless explicitly requested.

## Avoid Deprecated Patterns

- Do not add new `expo-av` usage. Use `expo-audio` for audio playback/recording instead.
- Do not use React Native's built-in `SafeAreaView`. Use `react-native-safe-area-context` instead.
- Do not use the legacy top-level Expo `splash` config. Use the `expo-splash-screen` config plugin instead.
- Do not opt out of React Native New Architecture with `newArchEnabled: false`. Keep the app on the default Expo SDK 54+ architecture path.

We will work now only in the mobile app.

## Test order (mobile)

- Before running any other test command, run `npm run typecheck` in `mobile/`.
- Only after `npm run typecheck` passes, run other tests such as `npm test`.

### No silent errors
when catching errors always console.log them, we will remove console log for production in a later step