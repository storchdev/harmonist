# Project Constraints

## 1. Data Integrity

- **Source of Truth:** The `regionsData` prop (JSON from backend) is the **only** source of truth for chord data.
- **Visual State:** The WaveSurfer regions (`wsRegions`) are purely a visual representation. Never read data back from `region.content` or `region.data` for business logic, as these are often mutated by the library (e.g., converting strings to DOM elements).
- **Sanitization:** Any chord region with `duration < 0.1s` is considered invalid/corrupt and must be filtered out during rendering and playback.

## 2. Audio Engine

- **Initialization:** Tone.js requires a user gesture to start. The `ensureReady()` method must be called on the first `play` event.
- **Zero Duration:** The synthesizer (`Tone.PolySynth`) crashes if triggered with a duration of 0. We must explicitly guard against this in the `audioprocess` loop.
- **Stop on Pause:** The synth does not automatically stop when the audio file stops. We must manually call `player.stopAll()` on `pause` and `seeking` events.

## 3. Waveform Visualization

- **One-Time Initialization:** `WaveSurfer.create` must only run **once** (`onMount`). Running it inside a reactive `$effect` causes infinite destroy/create loops.
- **Decode Wait:** Regions cannot be rendered onto the timeline until the `decode` event fires. Rendering before this event results in "ghost regions" clamped to 0s duration because the audio length is unknown.
- **Drag State:** While the user is dragging a region, the parent component must **not** force a re-render of the visual regions. This causes the UI to stutter or reset mid-drag.

## 4. Interaction Logic

- **No Overlaps:** Chords are "solid objects." A chord cannot be dragged through another chord. It must clamp to the neighbor's edge.
- **Minimum Duration:** A chord cannot be resized to be smaller than `MIN_DURATION` (0.1s).
