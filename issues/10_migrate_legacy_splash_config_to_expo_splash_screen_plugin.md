# Migrate Legacy Splash Config To expo-splash-screen Plugin

## Summary
The mobile app still uses the legacy top-level `splash` configuration block in Expo app config. Expo documents this configuration path as legacy and recommends the `expo-splash-screen` config plugin instead. This issue should move the current splash setup to the supported plugin-based configuration before the legacy config path is removed.

## Current State
[`mobile/app.json`](/home/roland/PhpstormProjects/singingApp/mobile/app.json) defines splash behavior through the top-level `expo.splash` block with an image, resize mode, and background color.

There is no current evidence that the app is using the `expo-splash-screen` plugin-based configuration as the primary source of splash settings.

## Proposed Changes
- Add or configure `expo-splash-screen` using the recommended config plugin approach.
- Move the current splash image, resize mode, and background color settings into plugin configuration.
- Remove the legacy top-level `splash` block once equivalent plugin configuration is in place.
- Verify splash behavior in a release-style build, especially because Android automation already depends on release APKs.
- Confirm platform-specific assets and behavior are preserved after the config migration.

## Acceptance Criteria
- `mobile/app.json` no longer relies on the legacy top-level `splash` config.
- Splash configuration is expressed through the supported `expo-splash-screen` plugin path.
- Existing splash visuals remain equivalent unless an intentional design change is made.
- Release builds still show the expected splash screen on app launch.

## Notes
- This is primarily a config migration, but it should be validated with an actual build because splash behavior is easy to regress without obvious compile-time failures.
- Keep the migration narrow; avoid mixing unrelated app-config cleanup into this issue.
