# Architectural Decisions

## 1. State Management (Svelte 5)

- **Decision:** Use `onMount` for setup and Runes (`$state`, `$effect`) for reactivity.
- **Why:** Decouples the imperative, DOM-heavy WaveSurfer lifecycle from Svelte's reactive data flow, preventing initialization loops.

## 2. Chord Parsing & Slash Support

- **Problem:** Tonal.js inconsistently handles slash chords (`G/B`) depending on the function used.
- **Decision:** Manual String Parsing.
- **Logic:** We split the input string by `/`. The left part is parsed as the **Chord** (must have `tonic`), and the right part is parsed as the **Bass Note**. This allows us to support specific voicings (playing the bass note an octave lower) reliably.

## 3. Octave Handling

- **Decision:** Store `octave` as an explicit number in the region data (Default: 4).
- **Playback Logic:** The chord voicing plays at the selected octave. If a slash bass exists (or tonic if not), that single note plays at `octave - 1`.
- **UI:** A slider in the edit modal controls this, persisting it to the backend JSON.

## 4. Overlap & Collision Detection

- **Initial Approach:** Index-based neighbors (`index - 1`). Failed because drag order is unstable.
- **Current Approach:** Stateless Collision Check.
- **Logic:** On every drag frame, check intersection with _all_ other regions. If colliding, clamp the moving edge to the neighbor's boundary. This acts as a "hard wall" and prevents passing through solid chords.

## 5. Audio Playback Sync

- **Decision:** WaveSurfer `audioprocess` event.
- **Why:** Reliable frame-accurate triggering during playback.
- **Logic:** Track `lastTime`. Trigger chords starting in the window `[lastTime, currentTime]`.
