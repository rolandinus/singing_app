# Singing App

A browser-based sight-singing trainer with progressive exercise types and local progress tracking.

## Current Main App

- Entry page: `singV3.html`
- Legacy reference page: `singV2.html`
- JavaScript source: `src/js/`

## Features

- Dashboard with skill map and recent sessions
- Guided sessions and custom sessions
- Exercise families:
  - Visual (note naming, interval recognition, rhythm recognition)
  - Aural (interval recognition)
  - Singing (single note, interval, melodies)
- Treble and bass clef support
- Local persistence (IndexedDB with localStorage fallback)

## Run Locally

From the project root:

```bash
./scripts/dev-server.sh
```

Open:

- `http://127.0.0.1:5173/singV3.html`

Optional custom port:

```bash
./scripts/dev-server.sh 8080
```

## Project Structure

- `src/js/app/` app bootstrap and orchestration
- `src/js/domain/` exercise generation, evaluation, progression, session planning
- `src/js/data/` settings/progress persistence
- `src/js/ui/` screen/view rendering
- `src/js/render/` music staff rendering
- `src/js/audio/` playback helpers
- `src/js/utils/` shared helpers
- `src/js/config/` curriculum and constants

## Notes

- Progress is stored locally in the browser.
- `singV2.html` is preserved as reference and is not the primary app shell.

## Android Automation

Headless Android emulator + Maestro smoke test setup is documented in:

- `mobile/docs/ANDROID_AUTOMATION.md`
