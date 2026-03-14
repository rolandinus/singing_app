# 03 note name

## Request
On single note exercise always display the name of the note (eg, d3, c4).
Also make the staff a bit bigger but shorter, since it needs to hold only one note.

## Outcome
resolved

## Work done
- Updated `mobile/app/(tabs)/practice.tsx` to always show the target note name prominently during `sing_note` exercises.
- Extended `mobile/src/ui/components/StaffSvg.tsx` with a single-note layout mode.
- In single-note mode, the staff renders with larger noteheads and a shorter component height for a compact one-note presentation.

## Validation
- `npm run typecheck` (in `mobile/`)
- `npm test` (in `mobile/`)
