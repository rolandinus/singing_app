# 05 prime frequency

## Request
For all exercises: Prime interval should only have a third of the probability to occur compared to other intervals since it is boring.

## Outcome
resolved

## Work done
- Added weighted interval-step pooling in `mobile/src/core/domain/exercise-generator.ts`.
- Prime (`intervalStep = 1`) now has weight `1` while all other interval steps have weight `3`.
- Interval pair generation now samples from this weighted pool, reducing prime frequency to one-third relative to each other interval.
- Added tests for weighted pool behavior.

## Validation
- `npm run typecheck` (in `mobile/`)
- `npm test` (in `mobile/`)
