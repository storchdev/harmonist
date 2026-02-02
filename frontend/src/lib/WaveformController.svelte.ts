import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { ChordPlayer } from "./ChordPlayer";
import type { ChordRegion, RegionChangeEvent } from "../types";

const MIN_DURATION = 0.1;
const COLOR_DEFAULT = "rgba(59, 130, 246, 0.2)";
const COLOR_SELECTED = "rgba(239, 68, 68, 0.4)";

export class WaveformController {
  private ws: WaveSurfer;
  private wsRegions: RegionsPlugin;
  private player: ChordPlayer;
  private onRegionChange: (event: any) => void;
  private onUserInteraction: () => void;
  private lastTime = 0;

  // Reactive State
  isPlaying = $state(false);
  currentTime = $state(0);
  duration = $state(0);

  constructor(
    container: HTMLElement,
    onRegionChange: (event: any) => void,
    onUserInteraction: () => void,
  ) {
    this.onRegionChange = onRegionChange;
    this.onUserInteraction = onUserInteraction;
    this.player = new ChordPlayer();

    this.ws = WaveSurfer.create({
      container,
      waveColor: "#4b5563",
      progressColor: "#3b82f6",
      height: 128,
      normalize: true,
      minPxPerSec: 50,
    });

    this.wsRegions = this.ws.registerPlugin(RegionsPlugin.create());

    this.setupAudioEvents();
    this.setupRegionEvents();
  }

  private setupAudioEvents() {
    this.ws.on("decode", () => {
      this.duration = this.ws.getDuration();
    });
    this.ws.on("play", () => {
      this.isPlaying = true;
      this.player.ensureReady();
      this.onUserInteraction(); // Clear AI popup
    });
    this.ws.on("pause", () => {
      this.isPlaying = false;
      this.player.stopAll();
    });
    this.ws.on("seeking", (t) => {
      this.lastTime = t;
      this.currentTime = t;
      this.player.stopAll();
      this.onUserInteraction(); // Clear AI popup
    });
    this.ws.on("timeupdate", (t) => {
      this.currentTime = t;
    });
    this.ws.on("audioprocess", (t) => {
      if (!this.ws.isPlaying()) return;

      // Simple region playback trigger
      const active = this.wsRegions
        .getRegions()
        .filter((r) => r.start >= this.lastTime + 0.1 && r.start <= t + 0.1);

      active.forEach((r) => {
        const content =
          (r as any).content?.innerText || (r as any).content || "";
        const dur = r.end - r.start;
        if (dur > 0.05 && content) this.player.playChord(content, dur, 4);
      });
      this.lastTime = t;
    });
  }

  private setupRegionEvents() {
    this.wsRegions.on("region-updated", (region) => {
      this.handleCollision(region);
      this.onRegionChange({
        id: region.id,
        start: region.start,
        end: region.end,
        content:
          (region as any).content?.innerText || (region as any).content || "",
      });
    });

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
      console.error(e);
    }
  }

  destroy() {
    this.player.stopAll();
    this.ws.destroy();
  }

  playPause() {
    this.ws.playPause();
  }

  setZoom(val: number) {
    this.ws.zoom(val);
  }

  getCurrentTime() {
    return this.ws.getCurrentTime();
  }

  setOscillator(type: any) {
    this.player.setOscillatorType(type);
  }

  setSynthVolume(val: number) {
    this.player.setVolume(val);
  }

  syncRegions(data: ChordRegion[]) {
    // Robust sync: Clear and redraw if counts mismatch or forced
    // (Simplest way to ensure "Regions show up" is to clear/add)
    const current = this.wsRegions.getRegions();
    if (current.length === 0 && data.length === 0) return;

    // Simple diffing by count to prevent constant flashing,
    // but allowing full redraw ensures sync
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

  addRegion(chordName: string) {
    const t = this.ws.getCurrentTime();
    // Overlap check
    const inside = this.wsRegions
      .getRegions()
      .find((r) => t >= r.start && t < r.end);
    if (inside) {
      this.selectRegion(inside.id);
      return;
    }

    let dur = 2.0;
    const next = this.wsRegions
      .getRegions()
      .filter((r) => r.start > t)
      .sort((a, b) => a.start - b.start)[0];

    if (next) dur = Math.min(dur, next.start - t);
    if (dur < MIN_DURATION) return;

    const r = this.wsRegions.addRegion({
      start: t,
      end: t + dur,
      content: chordName,
      color: COLOR_SELECTED,
    });

    this.onRegionChange({
      id: r.id,
      start: r.start,
      end: r.end,
      content: chordName,
    });
  }

  updateRegionContent(id: string, content: string, octave: number) {
    const r = this.wsRegions.getRegions().find((reg) => reg.id === id);
    if (r) {
      r.setOptions({ content });
      this.onRegionChange({
        id: r.id,
        start: r.start,
        end: r.end,
        content,
        octave,
      });
    }
  }

  // --- Navigation & Shortcuts ---

  handleShortcut(e: KeyboardEvent) {
    const SHIFT_JUMP = 5.0;
    const NORMAL_JUMP = 0.5;
    const jump = e.shiftKey ? SHIFT_JUMP : NORMAL_JUMP;

    // Boundary Logic
    const getBoundaries = () => {
      const times = this.wsRegions
        .getRegions()
        .flatMap((r) => [r.start, r.end]);
      return [...new Set(times)].sort((a, b) => a - b);
    };

    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "h") {
      if (e.altKey) {
        // Jump to prev boundary
        const bounds = getBoundaries();
        const prev = bounds.reverse().find((t) => t < this.currentTime - 0.05);
        this.ws.setTime(prev !== undefined ? prev : 0);
      } else {
        this.ws.setTime(Math.max(0, this.currentTime - jump));
      }
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "l") {
      if (e.altKey) {
        // Jump to next boundary
        const bounds = getBoundaries();
        const next = bounds.find((t) => t > this.currentTime + 0.05);
        this.ws.setTime(next !== undefined ? next : this.duration);
      } else {
        this.ws.setTime(Math.min(this.duration, this.currentTime + jump));
      }
    } else if (e.code === "Space") {
      e.preventDefault();
      this.playPause();
    }
  }

  // --- Internal Helpers ---

  private selectRegion(id: string | null) {
    this.wsRegions
      .getRegions()
      .forEach((r) =>
        r.setOptions({ color: r.id === id ? COLOR_SELECTED : COLOR_DEFAULT }),
      );
  }

  private handleCollision(region: any) {
    const others = this.wsRegions
      .getRegions()
      .filter((r) => r.id !== region.id);
    let modified = false;
    for (const other of others) {
      if (region.start < other.end && region.end > other.start) {
        const myCenter = (region.start + region.end) / 2;
        const otherCenter = (other.start + other.end) / 2;
        if (myCenter < otherCenter) {
          region.end = other.start;
          if (region.end - region.start < MIN_DURATION)
            region.start = region.end - MIN_DURATION;
        } else {
          region.start = other.end;
          if (region.end - region.start < MIN_DURATION)
            region.end = region.start + MIN_DURATION;
        }
        modified = true;
      }
    }
    if (modified) region.setOptions({ start: region.start, end: region.end });
  }
}
