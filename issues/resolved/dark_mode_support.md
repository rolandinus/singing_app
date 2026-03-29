# Dark Mode Support

## Summary
All colors in the app are hardcoded hex values. There is no `useColorScheme` hook usage anywhere in the codebase. On devices with dark mode enabled, the app remains fully light — white backgrounds, dark text — which is jarring at night, drains OLED battery, and ignores the user's system preference.

## Current State
Every screen (`index.tsx`, `practice.tsx`, `summary.tsx`, `settings.tsx`) and every component (`Card.tsx`, `Screen.tsx`, `MelodyTrainerPanel.tsx`, etc.) hardcodes colors directly in `StyleSheet.create()`. No theme context, no `useColorScheme`, no conditional color logic exists.

## Proposed Approach
A minimal, non-disruptive approach to avoid a large refactor in one go:

1. **Create a `useThemeColors()` hook** (e.g. `mobile/src/ui/hooks/use-theme-colors.ts`) that reads `useColorScheme()` and returns a flat color token object (light and dark variants). Token names match what is already used in styles (e.g. `background`, `surface`, `textPrimary`, `textMuted`, `border`, `primary`, `danger`).

2. **Migrate one screen at a time**, starting with `Screen.tsx` and `Card.tsx` (the two layout primitives used everywhere). Once these support dark backgrounds, the overall look improves immediately even before all screens are migrated.

3. **Do not redesign colors** — just provide sensible dark equivalents for each current light color (e.g. `#0f172a` background → `#0f172a` already dark; white surface → `#1e293b`; `#64748b` muted text stays readable on dark).

## Scope (suggested order)
- [ ] `Screen.tsx` — background
- [ ] `Card.tsx` — surface background, border
- [ ] `index.tsx` — hero card, badges, skill map
- [ ] `practice.tsx` — chips, choice buttons, confirm panel
- [ ] `summary.tsx` — accuracy circle, skill rows
- [ ] `MelodyTrainerPanel.tsx` — control buttons, staff label
- [ ] `settings.tsx`

## Acceptance Criteria
- On a device/simulator in dark mode, the app renders with a dark background and appropriate contrast.
- On a device in light mode, the app looks identical to today.
- No hardcoded color values remain in screen or shared component files — all colors come from the theme hook.
- The `useThemeColors` hook is the single source of truth for the color palette.
