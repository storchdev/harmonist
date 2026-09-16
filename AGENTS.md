# Agent Notes for Harmonist

Consolidated from the former ARCHITECTURE.md, CONSTRAINTS.md, DECISIONS.md,
and docs/THEMING.md, with stale content (old font/color scheme, outdated
file references) corrected to match the current codebase.

## 1. Frontend Architecture

Svelte 5 (Runes) for the view layer, TypeScript classes for the logic layer.

```text
frontend/src/
├── components/
│   ├── Waveform.svelte        # View: canvas container + editor/context-menu overlays
│   ├── AiSettings.svelte      # Floating modal for AI inference params
│   └── ShortcutsHelp.svelte   # Keyboard shortcuts reference modal
├── lib/
│   ├── api.ts                     # Axios wrapper for the Flask backend
│   ├── projectStore.svelte.ts     # Global state: CRUD, undo history, dirty tracking, file IO
│   ├── ChordPlayer.ts             # Audio engine (Tone.js wrapper)
│   ├── WaveformController.svelte.ts  # Coordinator class wrapping WaveSurfer
│   ├── RegionManager.ts           # Chord-region CRUD, collision physics, sync
│   ├── NoteManager.ts             # Point-in-time annotation markers, sync
│   ├── InputManager.ts            # Keyboard/mouse shortcut handling
│   └── chordParsing.ts            # Chord symbol parsing/validation
└── types.ts                       # Shared interfaces (ChordRegion, TimelineNote, ProjectData)
```

- `RegionManager` and `NoteManager` each register their own `RegionsPlugin`
  instance on the shared `WaveSurfer` object, kept separate so notes
  (zero-duration markers) don't participate in chord collision/z-index logic.
- **Shadow DOM gotcha:** WaveSurfer v7's `RegionsPlugin` appends region
  content into `wavesurfer.getWrapper()`, which lives inside a shadow root.
  Page-level `app.css` selectors (classes, `!important`, etc.) cannot reach
  that content — always style region/note marker elements with inline
  styles set via `Object.assign(el.style, {...})` in the manager class, not
  CSS classes.

## 2. Constraints & Invariants

### Data integrity

- The `regionsData`/`notesData` props (JSON from the backend) are the
  source of truth. Never trust `region.content`/`region.data` read back off
  a WaveSurfer region for business logic or for round-tripping text — the
  plugin stores whatever DOM node it was given, not the original string.
- Regions with `duration < 0.1s` are invalid and must be filtered/clamped.
- Every saved chord must have a detectable tonic (root note); qualities
  without roots (e.g. "5", "maj7") are rejected. Slash chords (`X/Y`) are
  valid only if `X` is a valid chord and `Y` is a valid note.

### Audio engine

- FM synthesis with a brick-wall `Tone.Limiter` on the master bus; synth
  volume is boosted to `-4dB` relying on the limiter (`-1dB` threshold) to
  prevent clipping during polyphony.
- `ensureReady()` must be triggered by a user gesture.
- Call `stopAll()` on `pause` and `seeking`, and before every `play()`, to
  prevent voice-stacking distortion when resuming mid-region.

### Waveform / timeline

- `WaveSurfer.create` runs exactly once, in `onMount`.
- Regions/notes must not be rendered until the `decode` event fires.
- Block parent re-renders while dragging (`!isDragging`) to avoid stutter.
- Chords are "solid" — dragging into a neighbor clamps the edge (collision
  detection uses center-of-mass to decide which side to clamp to).
  Resizing/clamping cannot shrink a region below `MIN_DURATION` (0.1s).
- Global keyboard shortcuts are disabled while focus is in an
  `<input>`/`<textarea>`.
- The AI button is a read-only "inspector" — it never modifies project
  state directly.

### Deployment

- The frontend builds to static files (`npm run build`) served by Flask.
  No separate Node server in production.

## 3. Key Architectural Decisions

- **AI inference is lazy, one-shot, and cached.** No whole-song
  pre-analysis (too slow, ~15s, and prone to rhythm hallucination). The
  model runs only when the user requests data for a specific file; raw
  MIDI output is cached to disk and read back instantly on subsequent
  requests. Backend = "ear" (raw notes), frontend = "brain" (chord naming).
- **Controller pattern.** `Waveform.svelte` was split into
  `WaveformController` (coordinator) + `RegionManager`/`NoteManager`
  (CRUD, physics, sync) + `InputManager` (shortcuts/focus guarding) once
  the component exceeded ~400 lines and mixed view logic with audio-engine
  logic.
- **Context-aware shortcuts.** Global mode: arrows seek, Ctrl+arrows jump
  to boundaries, Shift+arrows step by 0.1s. Selection mode: arrows move the
  region/note, Ctrl+arrows select neighbors, Shift+arrows resize.
- **Client-side project export/import** via `Blob`/`FileReader`, so users
  can back up or move projects without relying on backend ID persistence.

## 4. Theming (Shiki bundled editor themes)

The theme picker does not hand-author color palettes. It reuses
[Shiki](https://shiki.style)'s ~65 bundled VS Code editor themes (Tokyo
Night, Catppuccin, Rosé Pine, Dracula, Nord, Gruvbox, One Dark Pro, etc.)
and derives the app's UI colors from each theme's editor/token colors at
runtime — hundreds of professionally-designed palettes, already correctly
split into light/dark, for free.

- Import theme data from `shiki/themes` (themes-only, lazy-loadable per
  id), **not** `shiki/bundle/web` (pulls in language grammars too, adds
  megabytes).
- The app's own light/dark toggle (`theme: "light" | "dark"`, driven by
  `prefers-color-scheme` with manual override) is independent of theme
  *selection*, which is tracked separately per mode
  (`lightThemeId`/`darkThemeId` in localStorage) so switching modes doesn't
  clobber the user's choice for the other mode.
- Colors are extracted from a theme's `colors` map (`editor.background`,
  `panel.border`, `terminal.ansiGreen`, ...) and `tokenColors` (TextMate
  scopes like `entity.name.function`), each with a fallback chain, then run
  through the app's existing `shade()`/`withAlpha()` helpers to derive
  `-strong`/`-soft` variants and pushed onto `document.documentElement`
  as CSS custom properties (`--bg`, `--accent`, `--amber`, `--wave-color`,
  etc.).
- **CSS consumers** (region borders, fills, label chips via `var(--accent)`
  / `color-mix(...)`) update automatically when the custom properties
  change — no JS needed.
- **Canvas consumers** (WaveSurfer's `waveColor`/`progressColor`) are baked
  into canvas draw calls and need an explicit refresh:
  `WaveformController.refreshThemeColors()` reads the current
  `--wave-color`/`--wave-progress-color` via `getComputedStyle()` and calls
  `wavesurfer.setOptions(...)`, invoked once after every theme change.
- Each theme is dynamically imported into its own Vite chunk, so selecting
  a theme has a small one-time cost on first pick, then none.

Current UI font is **Inter** (loaded via Google Fonts in `app.css`) — an
earlier design pass specified Fraunces/Manrope and a fixed warm-light
palette, but that was superseded by the Shiki-driven theming system above
and is no longer accurate.

## 5. Checks

Run from `frontend/`:

```bash
npm run check   # svelte-check + tsc
npm run build   # vite build
```
