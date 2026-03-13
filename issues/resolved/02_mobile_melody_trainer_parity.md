# Build Dedicated Mobile Melody Trainer Parity

## Summary
The mobile app has baseline `sing_melody` support, but the active exercise still runs through the generic singing UI. The browser app has a dedicated melody trainer with its own controls, timing model, playback/count-in behavior, live guidance, and recorded-result visualization. Mobile needs that dedicated trainer surface to reach functional parity for melody singing instead of treating melody as just another prompt-plus-record action.

## Current State
`mobile/app/(tabs)/practice.tsx` renders `sing_melody` with the same generic structure used by the other singing exercises: one `StaffSvg`, a `play_prompt` button, a `record_and_evaluate` button, a debug panel, text feedback, and then `next_exercise`.

`mobile/src/core/services/session-service.ts` plays melody prompts by calling `audioPromptPort.playMelody(notes)` and records attempts with a fixed-length contour capture (`noteCount * 900` ms with `800` ms segments). `mobile/src/state/use-app-store.ts` advances the highlighted note on simple timeout intervals. The active flow does not model:

- a dedicated melody trainer panel
- count-in before recording
- BPM control
- visual metronome
- stop/cancel controls for prompt playback or in-progress capture
- separate generated vs recorded staff rendering
- per-note recorded result rendering
- tap-to-audition generated notes
- live wrong-note feedback while singing

The browser trainer already implements these capabilities in `singV3.html`, `src/js/ui/practice-view.js`, and `src/js/app/singing-trainer-app.js`.

## Proposed Changes
- Create a dedicated mobile melody trainer component/screen state for `sing_melody` rather than reusing the generic singing exercise layout.
- Replace the current one-button prompt flow with browser-parity controls for regenerate, play, record, and stop.
- Add tempo-aware timing to melody playback and capture so prompt playback, note highlighting, and scoring all use the same duration model instead of hard-coded `650`/`140`/`900` ms values.
- Add count-in support before recording, plus a visual metronome option and BPM control for melody attempts.
- Render both the generated melody staff and a recorded-result staff during/after the attempt, including note-by-note correctness markers similar to the browser trainer.
- Support note audition from the generated melody staff so users can tap notes to hear individual pitches.
- Expose live guidance during capture, including the currently active note slot and optional live wrong-pitch feedback, using the existing pitch-debug stream where possible.
- Wire explicit stop/cancel behavior through the mobile store/service layer so prompt playback and microphone capture can be interrupted safely.
- Add focused tests for melody trainer timing/state transitions and any new evaluator/result-shaping logic introduced for note-by-note rendering.

## Acceptance Criteria
- `sing_melody` no longer uses the generic singing exercise UI in mobile practice and instead shows a dedicated trainer surface.
- The user can regenerate a melody, play it back, start recording, and stop playback/capture without leaving the exercise.
- Recording starts with a count-in and uses a shared tempo model for playback, note highlighting, and evaluation.
- The UI shows both the target melody and the recorded melody/result state after an attempt.
- The trainer exposes BPM/metronome controls and keeps them scoped to melody practice.
- Melody attempts provide note-level visual feedback, not only a final percentage string.
- The new trainer flow is covered by targeted automated tests at the store/service/domain level, with any remaining UI-only gaps documented.

## Notes
- Hidden browser-only debug controls for continuous note detection can be folded into this issue if exact parity is still desired after the main trainer experience lands.
- This issue assumes melody-generation options are available from `01_mobile_melody_generation_controls.md`, but it can still start with default settings if needed.
