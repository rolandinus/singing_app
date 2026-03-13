# Replace Deprecated SafeAreaView Usage

## Summary
The shared mobile screen wrapper still uses React Native's built-in `SafeAreaView`, which is deprecated. The app should move to `react-native-safe-area-context` so layout handling follows the supported React Native path and behaves correctly with current edge-to-edge defaults.

## Current State
[`mobile/src/ui/components/Screen.tsx`](/home/roland/PhpstormProjects/singingApp/mobile/src/ui/components/Screen.tsx) imports `SafeAreaView` from `react-native` and wraps the app's scrollable screen content with it.

The app also enables Android edge-to-edge behavior in [`mobile/app.json`](/home/roland/PhpstormProjects/singingApp/mobile/app.json), which makes safe-area handling more important for top and bottom insets.

## Proposed Changes
- Add `react-native-safe-area-context` if it is not already present.
- Introduce the required safe-area provider at the app root if the library setup needs it.
- Replace the deprecated built-in `SafeAreaView` usage in the shared `Screen` component with the supported safe-area-context implementation.
- Verify padding and scroll behavior across the tab screens and summary flow after the migration.
- Confirm there are no remaining imports of deprecated `SafeAreaView` from `react-native` in the mobile app.

## Acceptance Criteria
- The mobile app no longer imports `SafeAreaView` from `react-native`.
- Shared screen layout uses `react-native-safe-area-context` instead.
- Dashboard, practice, settings, and summary screens render without clipped content around system bars.
- Safe-area handling remains compatible with the existing edge-to-edge Android configuration.

## Notes
- This should be treated as a focused UI infrastructure migration, not a visual redesign.
- If provider setup is added in the root layout, verify it does not conflict with Expo Router navigation structure.
