# Frontend Architecture

The frontend uses **Svelte 5** (Runes) for the View Layer and **TypeScript Classes** for the Logic Layer.

## 1. Directory Structure

```text
frontend/src/
├── components/
│   ├── Waveform.svelte       # Pure View (Canvas container + UI Overlays)
│   ├── AiSettings.svelte     # Floating Modal for AI params
│   └── ...
├── lib/
│   ├── api.ts                # Axios wrapper for Flask Backend
│   ├── projectStore.svelte.ts # Global State (CRUD, File IO)
│   ├── ChordPlayer.ts        # Audio Engine (Tone.js wrapper)
│   ├── WaveformController.ts # Coordinator Class
│   ├── RegionManager.ts      # Logic: WaveSurfer Regions Plugin wrapper
│   └── InputManager.ts       # Logic: Keyboard/Mouse event handler
└── types.ts                  # Shared Interfaces (ChordRegion, ProjectData)
```
