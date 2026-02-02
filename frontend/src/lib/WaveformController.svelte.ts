import WaveSurfer from "wavesurfer.js";
import { ChordPlayer } from "./ChordPlayer";
import { RegionManager } from "./RegionManager";
import { InputManager } from "./InputManager";
import type { ChordRegion } from "../types";

export class WaveformController {
  private ws: WaveSurfer;
  private player: ChordPlayer;

  // Sub-Modules
  public regions: RegionManager;
  public input: InputManager;

  // State
  isReady = $state(false);
  isPlaying = $state(false);
  currentTime = $state(0);
  duration = $state(0);

  private regionsCache: ChordRegion[] = [];
  private lastTime = 0;
  private onUserInteraction: () => void;
  private zoomLevel = 50;

  constructor(
    container: HTMLElement,
    callbacks: {
      onRegionChange: (event: any) => void;
      onUserInteraction: () => void;
      onShowContextMenu: (e: MouseEvent, id: string) => void;
      onEditRegion: (id: string) => void;
    },
  ) {
    this.onUserInteraction = callbacks.onUserInteraction;
    this.player = new ChordPlayer();

    // 1. Init WaveSurfer
    this.ws = WaveSurfer.create({
      container,
      waveColor: "#4b5563",
      progressColor: "#3b82f6",
      height: 128,
      normalize: true,
      minPxPerSec: 50,
    });

    // 2. Init Modules
    this.regions = new RegionManager(this.ws, callbacks);
    this.input = new InputManager(this, container);

    // 3. Setup Audio Engine
    this.setupAudioEvents();

    // 4. Click on blank space deselects
    this.ws.on("click", () => this.regions.select(null));
  }

  // --- Audio Engine ---

  private setupAudioEvents() {
    this.ws.on("decode", () => {
      this.duration = this.ws.getDuration();
      this.isReady = true;
    });

    this.ws.on("play", () => {
      this.isPlaying = true;
      this.player.ensureReady();
      this.onUserInteraction();
    });

    this.ws.on("pause", () => {
      this.isPlaying = false;
      this.player.stopAll();
    });

    this.ws.on("seeking", (t) => {
      this.lastTime = t;
      this.currentTime = t;
      this.player.stopAll();
      this.onUserInteraction();
    });

    this.ws.on("timeupdate", (t) => (this.currentTime = t));

    // Playback Loop
    this.ws.on("audioprocess", (t) => {
      if (!this.ws.isPlaying()) return;
      const active = this.regions
        .getAll()
        .filter((r) => r.start >= this.lastTime + 0.1 && r.start <= t + 0.1);

      active.forEach((r) => {
        const data = this.regionsCache.find((cache) => cache.id === r.id);
        if (data && r.end - r.start > 0.05) {
          this.player.playChord(data.chord_symbol, r.end - r.start, 4);
        }
      });
      this.lastTime = t;
    });
  }

  // --- Public API (Delegates) ---

  async load(url: string) {
    this.isReady = false;
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

  // Regions
  syncRegions(data: ChordRegion[]) {
    this.regionsCache = data;
    if (this.isReady) this.regions.sync(data);
  }

  addRegion(chord: string) {
    if (this.isReady) this.regions.add(this.ws.getCurrentTime(), chord);
  }

  updateRegionContent(id: string, content: string, octave: number) {
    this.regions.updateContent(id, content, octave);
  }

  deleteSelected() {
    if (this.regions.selectedRegionId) {
      this.regions.delete(this.regions.selectedRegionId);
    }
  }

  deleteRegion(id: string) {
    this.regions.delete(id);
  }

  hasSelectedRegion() {
    return this.regions.selectedRegionId !== null;
  }

  // Audio Controls
  playPause() {
    this.ws.playPause();
  }
  getCurrentTime() {
    return this.ws.getCurrentTime();
  }
  setOscillator(t: any) {
    this.player.setOscillatorType(t);
  }
  setSynthVolume(v: number) {
    this.player.setVolume(v);
  }

  // Navigation
  seek(amount: number) {
    const target = Math.max(
      0,
      Math.min(this.duration, this.currentTime + amount),
    );
    this.ws.setTime(target);
  }

  seekToBoundary(direction: number) {
    const bounds = this.regions.getBoundaries();
    let target;
    if (direction < 0) {
      target = bounds.reverse().find((t) => t < this.currentTime - 0.05);
      if (target === undefined) target = 0;
    } else {
      target = bounds.find((t) => t > this.currentTime + 0.05);
      if (target === undefined) target = this.duration;
    }
    this.ws.setTime(target);
  }

  modifyZoom(delta: number) {
    this.zoomLevel = Math.max(10, Math.min(300, this.zoomLevel + delta));
    this.ws.zoom(this.zoomLevel);
  }

  setZoom(val: number) {
    this.zoomLevel = val;
    this.ws.zoom(val);
  }

  // Forward Keyboard Events from Svelte Window
  handleShortcut(e: KeyboardEvent) {
    this.input.handleKeyDown(e);
  }
}
