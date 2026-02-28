# Android QA Report (Phase 5)

Date: 2026-02-22
Project: `mobile/` (Expo React Native)
Scope: Visual + aural + singing recording (`note_naming`, `interval_visual`, `rhythm_id`, `interval_aural`, `sing_note`, `sing_interval`)
Deferred: Singing melody recording (`sing_melody`)

## Automated Preflight (Executed)

1. Unit tests
- Command: `npm test`
- Result: PASS
- Details: 5 test files, 8 tests passed.

2. Type checking
- Command: `npx tsc --noEmit`
- Result: PASS

3. Web export sanity (bundle/build health)
- Command: `HOME=/tmp CI=1 npx expo export --platform web`
- Result: PASS
- Details: `dist` exported successfully.

## Android Manual QA (To Execute)

Status legend: `PASS` | `FAIL` | `BLOCKED` | `NOT_RUN`

### Test Environment
- Emulator Android 14 (Pixel 7): `NOT_RUN`
- Emulator Android 12 (low-end profile): `NOT_RUN`
- Physical Android device (13+): `NOT_RUN`

### Smoke
- App boots without red screen/JS errors: `NOT_RUN`
- Dashboard/Practice/Settings/Summary routes open: `NOT_RUN`
- Cold restart returns to dashboard: `NOT_RUN`

### Localization
- Default language is German on first launch: `NOT_RUN`
- Switching to English updates stack titles: `NOT_RUN`
- Switching to English updates dashboard labels: `NOT_RUN`
- Switching to English updates practice labels/buttons/messages: `NOT_RUN`
- Switching to English updates summary labels: `NOT_RUN`
- Language persists after restart: `NOT_RUN`

### Guided Session Flow
- Start guided session from dashboard: `NOT_RUN`
- Session contains visual + aural + singing-note/interval exercises: `NOT_RUN`
- Aural interval prompt playback produces two tones: `NOT_RUN`
- Singing note/interval prompt playback works: `NOT_RUN`
- Singing note/interval recording and evaluation works: `NOT_RUN`
- Progress bar advances per completed exercise: `NOT_RUN`
- Answer selection shows feedback + highlights: `NOT_RUN`
- Next button disabled pre-answer and enabled post-answer: `NOT_RUN`
- End session navigates to summary with correct totals/accuracy: `NOT_RUN`

### Custom Session Flow
- Select each visual/aural/singing skill (excluding `sing_melody`) and both clefs: `NOT_RUN`
- Level/count input validation and clamping: `NOT_RUN`
- Custom session follows selected skill/clef: `NOT_RUN`
- Ending custom session updates recent sessions: `NOT_RUN`

### Settings and Persistence
- Enabled clef toggles save correctly: `NOT_RUN`
- Default clef remains valid when one clef disabled: `NOT_RUN`
- Daily goal persists across restart: `NOT_RUN`
- Recent sessions sorted newest-first and persisted: `NOT_RUN`

### Visual/Interaction Quality
- No clipped text on small viewport: `NOT_RUN`
- Touch targets comfortable for tapping: `NOT_RUN`
- Smooth scrolling + keyboard behavior: `NOT_RUN`

### Stability
- No crashes under rapid navigation: `NOT_RUN`
- No crash when ending session early: `NOT_RUN`
- No duplicate submission on repeated taps: `NOT_RUN`

## Issue Log
- None yet.

## Exit Criteria Summary
- Automated checks: PASS
- Android manual checks: PENDING
- Overall status: PENDING
