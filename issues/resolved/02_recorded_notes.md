In the singing exercise after recording finished, the recorded notes on the staff are not displayed - there are just red or green points about the staff but it should display the recorded melody vs the supposed melody

## Resolved

- Changed the melody result staff to render the detected melody notes in their original note slots instead of red/green markers only.
- Kept the target melody staff visible separately so the recorded melody can be visually compared against the expected melody.
- Added a pure helper for translating recorded MIDI values into renderable staff notes and covered it with tests.

## Validation

- `npm test -- --run src/tests/melody-result-notes.test.ts`
- `npm test`
