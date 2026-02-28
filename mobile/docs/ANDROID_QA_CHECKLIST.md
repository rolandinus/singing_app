# Android QA Checklist (Phase 3)

## Scope
- Build target: Expo React Native app in `mobile/`
- Feature scope: visual + aural training (`note_naming`, `interval_visual`, `rhythm_id`, `interval_aural`)
- Deferred scope: singing capture/recording (`sing_note`, `sing_interval`, `sing_melody`)
- Data scope: fresh mobile profile, local persistence via AsyncStorage

## Test Environment
- Android emulator: Pixel 7 (Android 14) and one low-end profile (Android 12)
- Physical device: at least one mid-range Android phone (Android 13+)
- App launch command: `npm run android`

## Smoke
- App boots without red screen or JS errors.
- Dashboard, Practice, Settings, Summary routes open correctly.
- App survives cold restart and returns to dashboard.

## Localization
- Default language is German on first launch.
- In Settings, switching language to English updates:
  - stack titles
  - dashboard labels
  - practice labels/buttons/messages
  - summary labels
- Language choice persists after app restart.

## Guided Session Flow
- Start guided session from dashboard.
- Session shows visual + aural exercises only.
- For aural interval exercises, `Prompt abspielen`/`Play prompt` produces two audible tones.
- Progress bar advances per completed exercise.
- Selecting an answer shows feedback and highlights.
- `Nächste Übung`/`Next exercise` is disabled before answering and enabled after answering.
- Ending session navigates to summary with correct totals and accuracy.

## Custom Session Flow
- In Practice, select each visual/aural skill and both clefs.
- Level and count inputs accept valid numbers and clamp out-of-range values.
- Start custom session produces chosen skill/clef exercises.
- Ending custom session writes to recent sessions.

## Settings and Persistence
- Toggle enabled clefs and save.
- Default clef remains valid when one clef is disabled.
- Daily goal save persists across app restart.
- Recent sessions list persists and is ordered newest-first.

## Visual/Interaction Quality
- No clipped text on small Android viewport.
- Touch targets are comfortably tappable (buttons/chips/choices).
- Scroll behavior is smooth and no blocked areas appear with keyboard open.

## Stability
- No crashes during rapid navigation between screens.
- No crashes when ending session early.
- No duplicated submissions when repeatedly tapping the same choice.

## Exit Criteria
- All checklist items pass on emulator and physical device.
- Any remaining issue is logged with reproduction steps, device model, Android version, and screenshot.
