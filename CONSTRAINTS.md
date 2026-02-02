# Project Constraints

## 1. Data Integrity & Validation

- **Source of Truth:** The `regionsData` prop (JSON) is the definitive source. Never trust `region.content` or `region.data` from WaveSurfer for business logic.
- **Sanitization:** Regions with `duration < 0.1s` are invalid and must be filtered out during rendering and playback.
- **Chord Validity:**
  - **Invariant:** Every saved chord must have a detectable **tonic** (root note). Qualities without roots (e.g., "5", "maj7") are rejected.
  - **Slash Chords:** Must be manually parsed. `X/Y` is valid only if `X` is a valid chord AND `Y` is a valid note.

## 2. Audio Engine

- **Sound Profile:** Use FM Synthesis with a **Limiter** on the master bus.
  - _Constraint:_ The synth volume is boosted to `-4dB` to maximize loudness, relying on the Limiter (`-1dB` threshold) to prevent digital clipping during polyphony.
- **Initialization:** `ensureReady()` must be triggered by a user gesture.
- **Lifecycle:**
  - Manually call `stopAll()` on `pause` and `seeking` events.
  - **Voice Clearing:** Before resuming playback (especially in the middle of a region), all previous voices must be killed to prevent "voice stacking" distortion.

## 3. Waveform Visualization

- **Initialization:** `WaveSurfer.create` must run exactly **once** in `onMount`.
- **Decode Wait:** Regions must not be rendered until the `decode` event fires. Rendering early causes race conditions and invisible regions.
- **Drag State:** Parent re-renders must be blocked (`!isDragging`) while the user is interacting to prevent stuttering.

## 4. Interaction Logic

- **No Overlaps:** Chords are "solid." Dragging into a neighbor must strictly clamp the edge.
- **Collision Detection:** Use "Center of Mass" logic. If a drag intersects another region, clamp to the left or right edge based on relative center positions.
- **Minimum Duration:** Resizing or clamping cannot reduce a region below `MIN_DURATION` (0.1s).
- **Global Shortcuts:**
  - Global shortcuts (Space, H, L) must be **disabled** when the user is typing in an `<input>` or `<textarea>`.
- **AI Interaction:** The AI button is a read-only "Inspector". It never modifies project state directly.

## 5. Deployment

- **Build Process:** The frontend must be built to static files (`npm run build`) and served by Flask. We do not use a separate Node server in production.
