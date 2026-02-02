# Architectural Decisions

## 1. AI Inference Strategy ("One-Shot Lazy Loading")

- **Decision:** We do not pre-analyze the entire song for regions.
- **Why:** AI analysis is slow (~15s) and often hallucinates rhythm.
- **Implementation:**
  1.  **Lazy:** The model runs only when the user requests data for a specific file.
  2.  **Cache:** The raw MIDI output is saved to disk (`.mid`).
  3.  **Query:** Subsequent requests read the MIDI file instantly.
- **Responsibility Split:** Backend = "Ear" (raw notes). Frontend = "Brain" (chord naming).

## 2. Audio Limiting & Voice Management

- **Problem:** Polyphonic FM synthesis caused digital clipping when resuming playback in dense regions.
- **Decision:** Insert a Brick-wall Limiter (`Tone.Limiter`) and enforce a strict `stopAll()` before every `play()` call.
- **Why:** Prevents "voice stacking" where the previous chord's release tail overlaps with the new chord's attack, causing a volume spike > 0dB.

## 3. Separation of Concerns (Controller Pattern)

- **Decision:** Split the "God Component" (`Waveform.svelte`) into a modular Class-based controller.
  - `WaveformController`: Coordinator.
  - `RegionManager`: Handles CRUD, Physics (collisions), and Sync.
  - `InputManager`: Handles Keyboard/Mouse shortcuts and Focus guarding.
- **Why:** `Waveform.svelte` exceeded 400 lines and mixed View logic with Audio Engine logic. The refactor allows distinct testing of physics vs. playback.

## 4. State Management (Svelte 5)

- **Decision:** Use `onMount` for setup and Runes (`$state`, `$effect`) for reactivity.
- **Why:** Decouples the imperative, DOM-heavy WaveSurfer lifecycle from Svelte's reactive data flow.

## 5. Navigation & Editing UX

- **Decision:** Context-Aware Shortcuts.
  - **Global Mode:** Arrow keys seek timeline. `Ctrl+Arrows` jump to boundaries. `Shift+Arrows` step by 0.1s.
  - **Region Mode (Selection Active):** Arrow keys move the region. `Ctrl+Arrows` select neighbors. `Shift+Arrows` resize the region edge.
- **Why:** Maximizes the utility of limited keys (H/L/Arrows) without requiring complex modal switching.

## 6. Data Portability

- **Decision:** Client-side Export/Import.
- **Why:** Users need to backup projects or move them between machines without relying on the database ID persistence (which might be wiped in dev).
- **Implementation:** `Blob` generation for download, `FileReader` for import.
