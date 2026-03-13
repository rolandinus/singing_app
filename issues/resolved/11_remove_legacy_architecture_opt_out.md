# Remove Legacy Architecture Opt-Out

## Summary
The mobile app explicitly disables React Native New Architecture through Expo config. On Expo SDK 54 this keeps the app on the legacy architecture path even though Expo is treating New Architecture as the default direction and SDK 54 is the last release that allows opting out. This issue should remove the opt-out and validate that the app runs correctly on the supported architecture path.

## Current State
[`mobile/app.json`](/home/roland/PhpstormProjects/singingApp/mobile/app.json) sets `newArchEnabled` to `false`.

The app depends on Expo Router, Expo Audio, React Native SVG, AsyncStorage, Zustand, and custom audio capture/playback adapters. Those integrations should be validated under New Architecture instead of staying pinned to the legacy runtime path.

## Proposed Changes
- Remove the explicit `newArchEnabled: false` opt-out from Expo config.
- Validate that the current dependency set and native modules are compatible with Expo SDK 54 under New Architecture.
- Run the main mobile flows, especially singing capture/evaluation and prompt playback, after enabling the default architecture path.
- Fix any app-level incompatibilities that are exposed specifically by the architecture switch.
- Update any project notes or follow-up issues if specific third-party packages remain blockers.

## Acceptance Criteria
- Expo config no longer disables New Architecture.
- The app starts and core mobile flows work under the default Expo SDK 54 architecture path.
- Any discovered compatibility problems are either fixed in the same change or broken out into explicit follow-up issues.
- The project is no longer relying on SDK 54's temporary legacy-architecture escape hatch.

## Notes
- This issue is about upgrade readiness. It may expose unrelated library problems, but the goal is to stop carrying an explicit legacy opt-out.
- If another deprecated dependency blocks New Architecture, capture that dependency clearly rather than silently restoring the opt-out.
