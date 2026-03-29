# Touch Targets Below Minimum Size

## Summary
Several interactive elements are smaller than the 44pt iOS / 48dp Android minimum touch target. This makes them hard to tap accurately, especially during a singing session when the user is holding a device one-handed.

## Affected Elements

### `mobile/src/ui/components/MelodyTrainerPanel.tsx`
- **BPM +/− buttons** (`bpmBtn`): `width: 36, height: 36` — 8px too small in both dimensions.
- **Note tap targets** (`noteTapTarget`): `TAP_HALF_WIDTH = 18`, so effective tap width = 36px. These invisible overlays on the staff notes span the full staff height (160px) but are only 36px wide. Should be at least 44px wide.

### `mobile/app/(tabs)/practice.tsx`
- **End session link button** (`endLinkButton`): `minHeight: 36` — 8px below minimum. This is a destructive action; accidental mis-taps are especially costly.
- **Confirm action buttons** (`confirmButton`): `minHeight: 40` — 4px below minimum. These are inside the end-session confirmation panel.

## Proposed Fix
Increase the relevant style values:
- `bpmBtn`: `width: 44, height: 44`
- `noteTapTarget` / `TAP_HALF_WIDTH`: increase constant from `18` to `22` (→ 44px tap width)
- `endLinkButton`: `minHeight: 44`
- `confirmButton`: `minHeight: 44`

No visual or layout changes are required for `bpmBtn` or `confirmButton` beyond the size increase (content is centered). For the end session link, padding can absorb the extra height invisibly.

## Acceptance Criteria
- All tappable elements in `MelodyTrainerPanel` and the practice session flow meet the 44px minimum.
- Existing layout and appearance is otherwise unchanged.
