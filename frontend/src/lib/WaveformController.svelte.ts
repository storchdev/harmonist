// frontend/src/lib/WaveformController.svelte.ts
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { ChordPlayer } from "./ChordPlayer"; // Assuming this exists from your original code
import type { ChordRegion, RegionChangeEvent } from "../types";

// Constants
const MIN_DURATION = 0.1;
const COLOR_DEFAULT = "rgba(59, 130, 246, 0.2)";
const COLOR_SELECTED = "rgba(239, 68, 68, 0.4)";

export class WaveformController {
  // --- Internal State ---
  private ws: WaveSurfer;
  private wsRegions: RegionsPlugin;
  private player: ChordPlayer;
  private onRegionChange: (
    event: RegionChangeEvent | { action: "delete"; id: string },
  ) => void;

  // Track last played time to prevent re-triggering chords every frame
  private lastTime = 0;

  // --- Reactive State (Svelte 5 Runes) ---
  // These can be read by the UI component
  isPlaying = $state(false);
  currentTime = $state(0);
  duration = $state(0);

  constructor(container: HTMLElement, onRegionChange: (event: any) => void) {
    this.onRegionChange = onRegionChange;
    this.player = new ChordPlayer();

    // 1. Init WaveSurfer
    this.ws = WaveSurfer.create({
      container,
      waveColor: "#4b5563",
      progressColor: "#3b82f6",
      height: 128,
      normalize: true,
      minPxPerSec: 50, // Default zoom
    });

    // 2. Init Regions Plugin
    this.wsRegions = this.ws.registerPlugin(RegionsPlugin.create());

    // 3. Setup Events
    this.setupAudioEvents();
    this.setupRegionEvents();
  }

  // --- Setup Methods ---

  private setupAudioEvents() {
    this.ws.on("decode", () => {
      this.duration = this.ws.getDuration();
    });

    this.ws.on("play", () => {
      this.isPlaying = true;
      this.player.ensureReady();
    });

    this.ws.on("pause", () => {
      this.isPlaying = false;
      this.player.stopAll();
    });

    this.ws.on("seeking", (t) => {
      this.lastTime = t;
      this.currentTime = t;
      this.player.stopAll();
    });

    this.ws.on("timeupdate", (t) => {
      this.currentTime = t;
    });

    // The "Game Loop" for audio processing
    this.ws.on("audioprocess", (currentTime) => {
      if (!this.ws.isPlaying()) return;

      // Find regions that started since the last frame
      const activeRegions = this.wsRegions.getRegions().filter((r) => {
        return r.start >= this.lastTime + 0.1 && r.start <= currentTime + 0.1;
      });

      activeRegions.forEach((r) => {
        // We read the 'content' directly from the region options
        const content = r.content?.innerText || (r as any).content; // content implementation varies by version
        const duration = r.end - r.start;

        // Use default octave 4 if not stored in region data object (requires lookup if needed)
        // For simplicity, we assume we just trigger the chord name here
        if (duration > 0.05 && content) {
          this.player.playChord(content, duration, 4);
        }
      });

      this.lastTime = currentTime;
    });
  }

  private setupRegionEvents() {
    // Handling Drag/Resize Collisions
    this.wsRegions.on("region-updated", (region) => {
      this.handleCollision(region);

      // Notify Parent
      this.onRegionChange({
        id: region.id,
        start: region.start,
        end: region.end,
        content: region.content?.innerText || "",
      });
    });

    // Styling selection
    this.wsRegions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      this.selectRegion(region.id);
    });

    this.ws.on("click", () => this.selectRegion(null));
  }

  // --- Public API ---

  async load(url: string) {
    try {
      await this.ws.load(url);
    } catch (e) {
      console.error("WaveSurfer load error", e);
    }
  }

  destroy() {
    this.player.stopAll();
    this.ws.destroy();
  }

  playPause() {
    this.ws.playPause();
  }

  setZoom(pxPerSec: number) {
    this.ws.zoom(pxPerSec);
  }

  getCurrentTime() {
    return this.ws.getCurrentTime();
  }

  /**
   * Called by Svelte effect when data changes.
   * Efficiently updates regions without destroying drag state if possible.
   */
  syncRegions(data: ChordRegion[]) {
    // If the counts are vastly different, or empty, do a full redraw
    // (A production app might diff this more carefully)
    const currentRegions = this.wsRegions.getRegions();

    if (currentRegions.length !== data.length || currentRegions.length === 0) {
      this.wsRegions.clearRegions();
      data.forEach((r) => {
        if (r.end - r.start < MIN_DURATION) return;
        this.wsRegions.addRegion({
          id: r.id,
          start: r.start,
          end: r.end,
          content: r.chord_symbol,
          color: COLOR_DEFAULT,
          drag: true,
          resize: true,
        });
      });
    }
  }

  addRegion(chordName: string) {
    const time = this.ws.getCurrentTime();

    // Check if we are inside a region already
    const existing = this.wsRegions
      .getRegions()
      .find((r) => time >= r.start && time < r.end);
    if (existing) {
      this.selectRegion(existing.id);
      return;
    }

    // Determine duration (don't overlap next region)
    let duration = 2.0;
    const nextRegion = this.wsRegions
      .getRegions()
      .filter((r) => r.start > time)
      .sort((a, b) => a.start - b.start)[0];

    if (nextRegion) {
      duration = Math.min(duration, nextRegion.start - time);
    }

    if (duration < MIN_DURATION) return;

    const newRegion = this.wsRegions.addRegion({
      start: time,
      end: time + duration,
      content: chordName,
      color: COLOR_SELECTED,
    });

    this.onRegionChange({
      id: newRegion.id,
      start: newRegion.start,
      end: newRegion.end,
      content: chordName,
    });
  }

  updateRegionContent(id: string, newContent: string, octave: number) {
    const region = this.wsRegions.getRegions().find((r) => r.id === id);
    if (region) {
      region.setOptions({ content: newContent });
      // Notify parent to save to backend
      this.onRegionChange({
        id: region.id,
        start: region.start,
        end: region.end,
        content: newContent,
        octave: octave,
      });
    }
  }

  // --- Logic Helpers ---

  handleShortcut(e: KeyboardEvent) {
    const SHIFT_JUMP = 5.0;
    const NORMAL_JUMP = 0.5;
    const jump = e.shiftKey ? SHIFT_JUMP : NORMAL_JUMP;

    switch (e.key) {
      case "ArrowLeft":
      case "h":
        this.ws.setTime(Math.max(0, this.ws.getCurrentTime() - jump));
        break;
      case "ArrowRight":
      case "l":
        this.ws.setTime(
          Math.min(this.duration, this.ws.getCurrentTime() + jump),
        );
        break;
      case " ":
        e.preventDefault();
        this.playPause();
        break;
    }
  }

  private selectRegion(id: string | null) {
    this.wsRegions.getRegions().forEach((r) => {
      r.setOptions({ color: r.id === id ? COLOR_SELECTED : COLOR_DEFAULT });
    });
  }

  private handleCollision(region: any) {
    // "Physics" logic to prevent overlapping regions
    const others = this.wsRegions
      .getRegions()
      .filter((r) => r.id !== region.id);
    let modified = false;

    for (const other of others) {
      if (region.start < other.end && region.end > other.start) {
        const myCenter = (region.start + region.end) / 2;
        const otherCenter = (other.start + other.end) / 2;

        if (myCenter < otherCenter) {
          // I am to the left
          region.end = other.start;
          if (region.end - region.start < MIN_DURATION) {
            region.start = region.end - MIN_DURATION;
          }
        } else {
          // I am to the right
          region.start = other.end;
          if (region.end - region.start < MIN_DURATION) {
            region.end = region.start + MIN_DURATION;
          }
        }
        modified = true;
      }
    }

    if (modified) {
      region.setOptions({ start: region.start, end: region.end });
    }
  }
}
