In the singinging exercise: During the count in play and accoustic metronome.

## Resolved

- Added an audio metronome tick to the melody count-in so each visual count-in beat now has a matching short acoustic click.
- Accented the first beat of the count-in for clearer entry timing.
- Covered the count-in audio behavior in the melody trainer service tests.

## Validation

- `npm test -- --run src/tests/melody-trainer.test.ts`
- `npm test`
