# Recording Retry After Failed Singing Attempt

## Original issue
In the mobile app (web endpoint), after a failed first recording attempt in singing exercises, pressing record again did nothing.

## Root cause
- `SessionService.captureSingingAttempt()` returned early when `currentEvaluation` was already set.
- After the first singing evaluation (especially incorrect), `currentEvaluation` remained non-null, so subsequent recording attempts were blocked.

## Comparison with resolved issue 01
- Different cause.
- Issue `01.md` was a web `Alert.alert()` no-op in `react-native-web` (confirmation callback never fired).
- This issue was a session-state guard in singing capture flow, unrelated to Alert/dialog handling.

## Changes made
- Updated `mobile/src/core/services/session-service.ts`:
  - Allow singing re-record when prior attempt was incorrect.
  - Keep blocking re-record when prior attempt is already correct.
  - Store one session result row per exercise (`exerciseId`) by replacing existing row on retry instead of appending duplicates.
- Added regression test in `mobile/src/tests/session-service.test.ts`:
  - Verifies a failed `sing_melody` attempt can be retried.
  - Verifies second (correct) attempt is accepted.
  - Verifies session summary counts one exercise result (`total = 1`) after retry.

## Validation
- `npm test -- --run src/tests/session-service.test.ts` (pass)
- `npx tsc --noEmit` (pass)
