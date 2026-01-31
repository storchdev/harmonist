# Project Constraints

## 1. Data Integrity & Validation

- **Source of Truth:** The `regionsData` prop (JSON) is the definitive source. Never trust `region.content` or `region.data` from WaveSurfer for business logic as they are mutated (DOM elements).
- **Sanitization:** Regions with `duration < 0.1s` are invalid and must be filtered out during rendering and playback.
- **Chord Validity:** All chords must be valid according to Tonal.js.
  - **Invariant:** Every saved chord must have a detectable **tonic** (root note). Inputs like "5", "7", or "maj7" (qualities without roots) are strictly rejected.
  - **Slash Chords:** Must be manually parsed. `X/Y` is valid only if `X` is a valid chord (with tonic) AND `Y` is a valid note.

## 2. Audio Engine

- **Sound Profile:** Use FM Synthesis (Bell/Electric Piano) for a cleaner, less jarring tone than raw oscillators.
- **Initialization:** `ensureReady()` must be triggered by a user gesture (Play).
- **Zero Duration:** The synth must never be triggered with duration <= 0 (causes crash).
- **Lifecycle:** Manually call `stopAll()` on `pause` and `seeking` events to prevent "stuck" notes.

## 3. Waveform Visualization

- **Initialization:** `WaveSurfer.create` must run exactly **once** in `onMount`.
- **Decode Wait:** Regions must not be rendered until the `decode` event fires to prevent 0-duration "ghost" regions.
- **Drag State:** Parent re-renders must be blocked (`!isDragging`) while the user is interacting to prevent stuttering or state resets mid-drag.

## 4. Interaction Logic

- **No Overlaps:** Chords are "solid." Dragging into a neighbor must strictly clamp the edge.
- **Collision Detection:** Use "Center of Mass" logic. If a drag intersects another region, clamp to the left or right edge based on relative center positions.
- **Minimum Duration:** Resizing or clamping cannot reduce a region below `MIN_DURATION` (0.1s).
