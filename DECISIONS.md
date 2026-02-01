# Architectural Decisions

## 1. AI Inference Strategy ("One-Shot Lazy Loading")

- **Decision:** We do not pre-analyze the entire song for regions.
- **Why:** AI analysis is slow (~15s) and often hallucinates rhythm.
- **Implementation:**
  1.  **Lazy:** The model runs only when the user requests data for a specific file.
  2.  **Cache:** The raw MIDI output is saved to disk (`.mid`).
  3.  **Query:** Subsequent requests read the MIDI file instantly to find notes at the specific timestamp (`time=12.5s`).
- **Responsibility Split:** The Backend acts as the "Ear" (returns raw notes: C, E, G). The Frontend acts as the "Brain" (uses Tonal.js to name the chord: "C Major").

## 2. Audio Limiting

- **Problem:** Polyphonic FM synthesis caused digital clipping (distortion) when 4+ notes played simultaneously.
- **Decision:** Insert a Brick-wall Limiter (`Tone.Limiter`).
- **Why:** Allows us to boost the perceived volume of single notes without destroying the audio quality during complex chords.

## 3. Settings Management

- **Decision:** Global Modal for AI Settings.
- **Why:** AI sensitivity parameters (`onset`, `frame_threshold`) are complex. Putting them in a dropdown inside the button was causing layout clipping issues. A centered modal detached from the button context is more robust.

## 4. State Management (Svelte 5)

- **Decision:** Use `onMount` for setup and Runes (`$state`, `$effect`) for reactivity.
- **Why:** Decouples the imperative, DOM-heavy WaveSurfer lifecycle from Svelte's reactive data flow, preventing initialization loops.

## 5. Region "Content" Handling

- **Problem:** WaveSurfer's Regions Plugin mutates the `content` property, turning a string ("Cm7") into an `HTMLElement` (`<div>Cm7</div>`) after rendering.
- **Decision:** We ignore `region.content` when reading data.
- **Solution:** When an event fires (click, drag, play), we take the `region.id` and look up the clean data from our own `regionsData` array. We only write to `region.content` when updating the visual label.
