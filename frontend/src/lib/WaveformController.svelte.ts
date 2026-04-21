import WaveSurfer from "wavesurfer.js";
import { ChordPlayer } from "./ChordPlayer";
import { RegionManager } from "./RegionManager";
import { InputManager } from "./InputManager";
import type { ChordRegion } from "../types";

export type WaveformScrollState = {
  position: number;
  max: number;
  canScroll: boolean;
};

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

    this.ws = WaveSurfer.create({
      container,
      backend: "WebAudio",
      waveColor: "#4b5563",
      progressColor: "#3b82f6",
      height: 128,
      normalize: true,
      minPxPerSec: 50,
      hideScrollbar: true,
    });

    this.regions = new RegionManager(this.ws, callbacks);
    this.input = new InputManager(this, container);

    this.setupAudioEvents();

    // Deselect on blank click
    this.ws.on("click", () => this.regions.select(null));
  }

  private setupAudioEvents() {
    this.ws.on("decode", () => {
      this.duration = this.ws.getDuration();
      this.isReady = true;
    });

    this.ws.on("play", () => {
      this.isPlaying = true;
      this.player.ensureReady();
      this.onUserInteraction();

      // [FIX] Stop previous voices to prevent distortion/stacking
      this.player.stopAll();

      // [FIX] Resume synth if starting inside a region
      const t = this.ws.getCurrentTime();
      const currentRegion = this.regions
        .getAll()
        .find((r) => t >= r.start && t < r.end);

      if (currentRegion) {
        const data = this.regionsCache.find(
          (cache) => cache.id === currentRegion.id,
        );
        if (data) {
          const remaining = currentRegion.end - t;
          // Guard against extremely short durations which cause "Quiet/Clicky" envelopes
          if (remaining > 0.05) {
            this.player.playChord(data.chord_symbol, remaining, 4);
          }
        }
      }
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

    this.ws.on("audioprocess", (t) => {
      if (!this.ws.isPlaying()) return;

      // Look for regions starting in this time slice
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

  // --- Public API ---

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

  syncRegions(data: ChordRegion[]) {
    this.regionsCache = data;
    if (this.isReady) this.regions.sync(data);
  }

  addRegion(chord: string) {
    if (this.isReady) this.regions.add(this.ws.getCurrentTime(), chord);
  }

  updateRegionContent(
    id: string,
    content: string,
    octave: number,
    comment?: string,
  ) {
    this.regions.updateContent(id, content, octave, comment);
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

  getScrollState(): WaveformScrollState {
    const wrapper = this.ws.getWrapper();
    const viewport = this.ws.getWidth();
    const max = Math.max(0, wrapper.scrollWidth - viewport);
    const position = Math.min(max, this.ws.getScroll());

    return {
      position,
      max,
      canScroll: max > 0,
    };
  }

  setScrollPosition(pixels: number) {
    const { max } = this.getScrollState();
    const target = Math.max(0, Math.min(max, pixels));
    this.ws.setScroll(target);
  }

  onScrollStateChange(callback: (state: WaveformScrollState) => void) {
    const emit = () => callback(this.getScrollState());

    const unsubscribers = [
      this.ws.on("scroll", emit),
      this.ws.on("zoom", emit),
      this.ws.on("decode", emit),
      this.ws.on("redrawcomplete", emit),
      this.ws.on("resize", emit),
    ];

    emit();

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  handleShortcut(e: KeyboardEvent) {
    this.input.handleKeyDown(e);
  }
}
