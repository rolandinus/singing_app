# Accessibility: Missing Labels and Roles on Interactive Elements

## Summary
Most `Pressable` elements in the app are missing `accessibilityRole` and/or `accessibilityLabel`. Screen readers (VoiceOver on iOS, TalkBack on Android) will announce these as unlabeled or use surrounding text context, which is confusing for visually impaired users.

## Affected Files

### `mobile/app/(tabs)/practice.tsx`
- Family/skill/clef chip selectors: no `accessibilityRole="button"` or label
- "Start custom session" button: has visible text but no `accessibilityRole`
- "Play prompt" button: no `accessibilityRole`
- "Record and evaluate" button: no `accessibilityRole`
- "Next exercise" button: no `accessibilityRole`
- "End session" link button: no `accessibilityRole`, no `accessibilityLabel` (text color hint only)
- Confirm "End now" / "Cancel" buttons: no `accessibilityRole`
- Answer choice buttons: `accessibilityRole` missing; screen reader cannot distinguish from passive content
- Interval / melody option chips: no `accessibilityRole`, no selected state communicated (`accessibilityState={{ selected }}`)

### `mobile/app/(tabs)/index.tsx`
- "Start guided session" button: no `accessibilityRole`

### `mobile/src/ui/components/MelodyTrainerPanel.tsx`
- BPM +/− buttons: no `accessibilityLabel` (show only "−" / "+" symbols)
- Play / Record / Stop / Regenerate buttons: no `accessibilityRole` or descriptive label
- Note tap targets already have `accessibilityLabel={note}` — this is correct

## Proposed Fix
Add `accessibilityRole="button"` to all `Pressable` elements that act as buttons. For elements where the visible label is ambiguous (BPM symbols, icon-only buttons), add an explicit `accessibilityLabel`. For toggle/chip selectors, add `accessibilityState={{ selected: isActive }}`.

This is a non-visual change — no styles need to change.

## Acceptance Criteria
- All tappable `Pressable` elements have `accessibilityRole="button"`.
- Symbol-only controls (BPM +/−) have descriptive `accessibilityLabel` values.
- Chip selectors expose their selected state via `accessibilityState`.
- No layout or visual changes.
