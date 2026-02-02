import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { ChordRegion } from "../types";

const MIN_DURATION = 0.1;
const COLOR_DEFAULT = "rgba(59, 130, 246, 0.2)";
const COLOR_SELECTED = "rgba(239, 68, 68, 0.4)";

export class RegionManager {
  private wsRegions: RegionsPlugin;
  public selectedRegionId: string | null = null;
  private onRegionChange: (event: any) => void;

  constructor(
    ws: WaveSurfer,
    callbacks: {
      onRegionChange: (event: any) => void;
      onEditRegion: (id: string) => void;
      onShowContextMenu: (e: MouseEvent, id: string) => void;
    },
  ) {
    this.wsRegions = ws.registerPlugin(RegionsPlugin.create());
    this.onRegionChange = callbacks.onRegionChange;

    this.setupEvents(callbacks);
  }

  private setupEvents(cbs: any) {
    // 1. Updates & Collisions
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

    // 2. Selection
    this.wsRegions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      this.select(region.id);
    });

    // 3. Interactions
    this.wsRegions.on("region-double-clicked", (region, e) => {
      e.stopPropagation();
      cbs.onEditRegion(region.id);
    });

    this.wsRegions.on("region-created", (region) => {
      if (region.element) {
        region.element.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.select(region.id);
          cbs.onShowContextMenu(e, region.id);
        });
      }
    });
  }

  // --- Public CRUD ---

  public sync(data: ChordRegion[]) {
    const current = this.wsRegions.getRegions();
    if (current.length === 0 || current.length !== data.length) {
      this.wsRegions.clearRegions();
      data.forEach((r) => {
        if (r.end - r.start < MIN_DURATION) return;
        this.wsRegions.addRegion({
          id: r.id,
          start: r.start,
          end: r.end,
          content: r.chord_symbol,
          color:
            r.id === this.selectedRegionId ? COLOR_SELECTED : COLOR_DEFAULT,
          drag: true,
          resize: true,
        });
      });
    }
  }

  public add(time: number, chordName: string) {
    // Check Overlap
    const inside = this.wsRegions
      .getRegions()
      .find((r) => time >= r.start && time < r.end);
    if (inside) {
      this.select(inside.id);
      return;
    }

    let dur = 2.0;
    const next = this.wsRegions
      .getRegions()
      .filter((r) => r.start > time)
      .sort((a, b) => a.start - b.start)[0];

    if (next) dur = Math.min(dur, next.start - time);
    if (dur < MIN_DURATION) return;

    const r = this.wsRegions.addRegion({
      start: time,
      end: time + dur,
      content: chordName,
      color: COLOR_SELECTED,
    });

    this.onRegionChange({
      id: r.id,
      start: r.start,
      end: r.end,
      content: chordName,
    });
    this.select(r.id);
  }

  public updateContent(id: string, content: string, octave: number) {
    const r = this.get(id);
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

  public delete(id: string) {
    const r = this.get(id);
    if (r) {
      r.remove();
      this.onRegionChange({ action: "delete", id });
      this.select(null);
    }
  }

  // --- Selection & Movement ---

  public select(id: string | null) {
    this.selectedRegionId = id;
    this.wsRegions
      .getRegions()
      .forEach((r) =>
        r.setOptions({ color: r.id === id ? COLOR_SELECTED : COLOR_DEFAULT }),
      );
  }

  public get(id: string) {
    return this.wsRegions.getRegions().find((r) => r.id === id);
  }

  public getAll() {
    return this.wsRegions.getRegions();
  }

  public selectNeighbor(direction: number) {
    const sorted = this.getAll().sort((a, b) => a.start - b.start);
    const idx = sorted.findIndex((r) => r.id === this.selectedRegionId);
    if (idx === -1) return;

    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < sorted.length) {
      this.select(sorted[newIdx].id);
    }
  }

  public nudgeSelected(direction: number, mode: "move" | "resize") {
    if (!this.selectedRegionId) return;
    const r = this.get(this.selectedRegionId);
    if (!r) return;

    const step = 0.1;

    if (mode === "move") {
      const newStart = r.start + step * direction;
      if (newStart < 0) return;
      r.setOptions({ start: newStart, end: newStart + (r.end - r.start) });
    } else {
      let newEnd = r.end + step * direction;
      if (newEnd - r.start < MIN_DURATION) newEnd = r.start + MIN_DURATION;
      r.setOptions({ end: newEnd });
    }
  }

  public getBoundaries() {
    const times = this.getAll().flatMap((r) => [r.start, r.end]);
    return [...new Set(times)].sort((a, b) => a - b);
  }

  // --- Internals ---

  private handleCollision(region: any) {
    const others = this.getAll().filter((r) => r.id !== region.id);
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
