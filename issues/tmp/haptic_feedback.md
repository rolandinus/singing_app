# Haptic Feedback on Key Interactions

## Summary
The app has no haptic feedback anywhere. On mobile, haptics are essential for confirming actions and conveying result valence (correct vs wrong). Without them, the experience feels flat — especially during singing exercises where the user cannot always watch the screen.

## Interactions That Should Have Haptics

| Interaction | Suggested Haptic | Rationale |
|---|---|---|
| Correct answer / exercise passed | Light impact or notification success | Positive reinforcement |
| Wrong answer | Medium impact or notification warning | Distinct from correct, not punishing |
| Recording starts | Light impact | Confirms mic is live |
| Recording ends (result arrives) | Light impact | Marks transition point |
| BPM button tap | Light selection feedback | Confirms the +/− step |
| "End session" confirmation tap | Medium impact | Destructive action — needs tactile weight |

## Implementation
Expo provides `expo-haptics` which wraps `UIImpactFeedbackGenerator` (iOS) and `VibrationEffect` (Android).

```typescript
import * as Haptics from 'expo-haptics';

// correct
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// wrong
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

// light tap (recording start/stop, BPM step)
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// destructive confirm
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
```

Haptic calls belong in the store actions or in the screen-level callbacks that receive feedback — not deep in domain logic.

## Acceptance Criteria
- Correct and wrong answer feedback produce distinct haptic patterns.
- Recording start is confirmed with a light impact.
- BPM changes produce a light selection feedback.
- The "End session" confirm button produces a medium impact before navigating away.
- Haptics degrade gracefully on devices/simulators where they are unavailable (the API is already safe to call — it no-ops silently).
