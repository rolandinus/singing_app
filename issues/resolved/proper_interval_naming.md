## Resolved

- The issue file was empty, so the implementation was inferred from its filename and the current code: visual and aural interval exercises were still using generic step names where a qualified musical name was available.
- Interval exercises now compute a proper interval label from the actual semitone distance and use that as the correct answer label.
- The answer model is unchanged; only the displayed naming was tightened.

## Validation

- `npm test -- --run src/tests/exercise-generator.test.ts`
- `npm test`
