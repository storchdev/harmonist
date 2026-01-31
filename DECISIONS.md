# Architectural Decisions

## 1. State Management (Svelte 5)

- **Decision:** Use Svelte 5 Runes (`$state`, `$effect`) over Svelte 4 stores.
- **Why:** Simplifies the synchronization between the "impure" WaveSurfer library and our application state.
- **Implementation:** We use `onMount` for the heavy imperative setup of WaveSurfer and `$effect` _only_ for reactive updates (like zooming or loading a new URL).

## 2. Region "Content" Handling

- **Problem:** WaveSurfer's Regions Plugin mutates the `content` property, turning a string ("Cm7") into an `HTMLElement` (`<div>Cm7</div>`) after rendering.
- **Decision:** We ignore `region.content` when reading data.
- **Solution:** When an event fires (click, drag, play), we take the `region.id` and look up the clean data from our own `regionsData` array. We only write to `region.content` when updating the visual label.

## 3. Overlap & Collision Detection

- **Initial Approach (Failed):** Calculating neighbors based on array index (`index - 1`).
  - _Failure Mode:_ Dragging a chord past another changed the sort order mid-drag, causing erratic clamping.
- **Current Approach (Success):** "Center of Mass" collision detection.
  - _Logic:_ On every drag frame, check if the active region intersects _any_ other region. If it does, determine if we are to the left or right of its center, and hard-clamp the edge accordingly. This is stateless and robust.

## 4. Audio Playback Sync

- **Decision:** Use `audioprocess` event from WaveSurfer.
- **Why:** It fires reliably during playback.
- **Logic:** We track `lastTime`. On every frame, we find regions where `start >= lastTime` and `start <= currentTime`. This ensures every chord fires exactly once when the playhead crosses it, even if the frame rate jitters.

## 5. File Format

- **Decision:** `.chordproj` JSON files store _references_ to audio files, not the audio itself.
- **Why:** Storing audio as base64 in JSON makes load times unacceptable. The backend serves audio via a dedicated `/api/audio/<filename>` route to handle browser security restrictions.
