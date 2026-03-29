# Remove Debug Artifacts from Production UI

## Summary
Two categories of developer-only content are currently visible/active for all users in the practice screen. They should be removed or hidden behind a build-time flag.

## 1. Mic Debug Panel (visible to users)

**File:** `mobile/app/(tabs)/practice.tsx` lines ~361–370

The panel labeled "Mic Debug" is rendered for every user whenever `currentExercise.family === 'singing'`. It exposes raw internal state:
- Recording phase
- Duration in milliseconds
- Metering level in dB
- Detected frequency in Hz
- Timeline sample count
- Last-updated timestamp

This is developer instrumentation, not user-facing content. Users see a block of numbers during every singing exercise, which is confusing and looks broken.

**Fix:** Remove the debug panel from the JSX. If future debugging is needed, gate it behind `__DEV__` or an environment variable.

## 2. `console.log` Calls in Practice Screen

**File:** `mobile/app/(tabs)/practice.tsx` — `logEndSessionDebug` function and all its call sites

The helper `logEndSessionDebug` wraps `console.log` and is called at several points during session end flow. In React Native, `console.log` on the JS thread is a known performance concern in production builds, and this logging exposes internal state/flow to anyone with access to device logs.

**Fix:** Remove `logEndSessionDebug` and all call sites. The end-session flow is now stable (covered by existing store/service logic); the logging is no longer needed.

## Acceptance Criteria
- The mic debug panel is not rendered during any singing exercise for a production user.
- `logEndSessionDebug` and all `console.log` call sites in `practice.tsx` are removed.
- No functionality is changed — only debug output is removed.
