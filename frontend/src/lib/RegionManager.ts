import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { ChordRegion } from "../types";

const MIN_DURATION = 0.1;
const COLOR_DEFAULT = "color-mix(in srgb, var(--amber) 32%, transparent)";
const COLOR_SELECTED = "color-mix(in srgb, var(--amber) 70%, transparent)";

type RegionLabelData = {
  chordSymbol: string;
  comment?: string;
};

export class RegionManager {
  private wsRegions: RegionsPlugin;
  public selectedRegionId: string | null = null;
  private onRegionChange: (event: any) => void;
  private playheadTime = 0;

  private readonly labelStyle: Partial<CSSStyleDeclaration> = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "max-content",
    maxWidth: "none",
    pointerEvents: "none",
    zIndex: "2",
    display: "block",
    overflow: "visible",
  };

  private readonly mainLabelStyle: Partial<CSSStyleDeclaration> = {
    border: "2px solid rgba(255, 255, 255, 0.25)",
    borderRadius: "999px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, color-mix(in srgb, black 45%, var(--amber) 30%) 62%, transparent), color-mix(in srgb, color-mix(in srgb, black 55%, var(--amber) 25%) 62%, transparent))",
    backdropFilter: "blur(6px)",
    color: "#fff",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.55)",
    padding: "0.2rem 0.65rem",
    fontSize: "0.9rem",
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: "0.01em",
    lineHeight: "1.15",
    boxShadow:
      "0 3px 10px color-mix(in srgb, var(--amber) 45%, transparent)",
    whiteSpace: "nowrap",
  };

  private readonly commentLabelStyle: Partial<CSSStyleDeclaration> = {
    position: "absolute",
    left: "50%",
    top: "calc(100% + 0.4rem)",
    transform: "translateX(-50%)",
    border: "2px solid rgba(255, 255, 255, 0.18)",
    borderRadius: "999px",
    background:
      "color-mix(in srgb, color-mix(in srgb, black 55%, var(--secondary) 18%) 62%, transparent)",
    backdropFilter: "blur(6px)",
    color: "#fff",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.55)",
    fontSize: "0.78rem",
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: "1.2",
    letterSpacing: "0.01em",
    padding: "0.15rem 0.55rem",
    textAlign: "center",
    whiteSpace: "normal",
    wordBreak: "break-word",
    width: "max-content",
    maxWidth: "220px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
  };

  private createLabelElement(data: RegionLabelData) {
    const label = document.createElement("div");
    label.className = "region-label-chip";
    this.setLabelElementText(label, data);
    Object.assign(label.style, this.labelStyle);
    return label;
  }

  private setLabelElementText(labelEl: HTMLElement, data: RegionLabelData) {
    labelEl.dataset.chordSymbol = data.chordSymbol;

    const normalizedComment = data.comment?.trim();
    if (normalizedComment) {
      labelEl.dataset.comment = normalizedComment;
    } else {
      delete labelEl.dataset.comment;
    }

    labelEl.replaceChildren();

    const chord = document.createElement("span");
    chord.className = "region-label-main";
    chord.textContent = data.chordSymbol;
    Object.assign(chord.style, this.mainLabelStyle);
    labelEl.append(chord);

    if (normalizedComment) {
      const comment = document.createElement("span");
      comment.className = "region-label-comment";
      comment.textContent = normalizedComment;
      Object.assign(comment.style, this.commentLabelStyle);
      labelEl.append(comment);
    }
  }

  private setRegionLabelData(region: any, data: RegionLabelData) {
    (region as any).harmonistLabelData = {
      chordSymbol: data.chordSymbol,
      comment: data.comment?.trim() || undefined,
    };
  }

  private getRegionLabelData(region: any): RegionLabelData {
    const labelData = (region as any).harmonistLabelData as
      | RegionLabelData
      | undefined;
    if (labelData?.chordSymbol) return labelData;

    const contentEl = (region as any).content;
    if (contentEl instanceof HTMLElement) {
      return {
        chordSymbol: contentEl.dataset.chordSymbol || "",
        comment: contentEl.dataset.comment || undefined,
      };
    }

    if (typeof contentEl === "string") {
      return { chordSymbol: contentEl.trim() };
    }

    return { chordSymbol: "" };
  }

  private isOverPlayhead(region: any): boolean {
    return this.playheadTime >= region.start && this.playheadTime < region.end;
  }

  private isRaised(region: any): boolean {
    return region.id === this.selectedRegionId || this.isOverPlayhead(region);
  }

  private applyZIndex(region: any) {
    const raised = this.isRaised(region);
    if (region.element) {
      region.element.style.zIndex = raised ? "5" : "1";
    }
    const contentEl = (region as any).content;
    if (contentEl instanceof HTMLElement) {
      contentEl.style.zIndex = raised ? "10" : "2";
    }
  }

  private styleRegionElement(region: any, labelData?: RegionLabelData) {
    const isSelected = region.id === this.selectedRegionId;

    if (region.element) {
      region.element.classList.add("harmonist-region");
      region.element.classList.toggle("region-selected", isSelected);
      region.element.style.position = "absolute";
      region.element.style.overflow = "visible";
    }

    const contentEl = (region as any).content;
    if (contentEl instanceof HTMLElement) {
      contentEl.classList.add("region-label-chip");
      if (labelData) this.setLabelElementText(contentEl, labelData);
      Object.assign(contentEl.style, this.labelStyle);
    }

    this.applyZIndex(region);

    if (labelData) {
      this.setRegionLabelData(region, labelData);
    }
  }

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
      const labelData = this.getRegionLabelData(region);
      this.onRegionChange({
        id: region.id,
        start: region.start,
        end: region.end,
        content: labelData.chordSymbol,
        comment: labelData.comment,
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
      this.styleRegionElement(region);

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
    const byIdData = new Map(data.map((item) => [item.id, item]));
    const needsRebuild =
      current.length !== data.length ||
      current.some((region) => {
        const saved = byIdData.get(region.id);
        return !saved || saved.start !== region.start || saved.end !== region.end;
      });

    if (current.length === 0 || needsRebuild) {
      this.wsRegions.clearRegions();
      data.forEach((r) => {
        if (r.end - r.start < MIN_DURATION) return;
        this.wsRegions.addRegion({
          id: r.id,
          start: r.start,
          end: r.end,
          content: this.createLabelElement({
            chordSymbol: r.chord_symbol,
            comment: r.comment,
          }),
          color:
            r.id === this.selectedRegionId ? COLOR_SELECTED : COLOR_DEFAULT,
          drag: true,
          resize: true,
        });
      });
    } else {
      current.forEach((region) => {
        const saved = byIdData.get(region.id);
        if (!saved) return;

        this.styleRegionElement(region, {
          chordSymbol: saved.chord_symbol,
          comment: saved.comment,
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
      content: this.createLabelElement({ chordSymbol: chordName }),
      color: COLOR_SELECTED,
    });

    this.styleRegionElement(r, { chordSymbol: chordName });

    this.onRegionChange({
      id: r.id,
      start: r.start,
      end: r.end,
      content: chordName,
      comment: undefined,
    });
    this.select(r.id);
  }

  public updateContent(
    id: string,
    content: string,
    octave: number,
    comment?: string,
  ) {
    const r = this.get(id);
    if (r) {
      const labelData = { chordSymbol: content, comment };
      r.setOptions({ content: this.createLabelElement(labelData) });
      this.styleRegionElement(r, labelData);
      this.onRegionChange({
        id: r.id,
        start: r.start,
        end: r.end,
        content,
        octave,
        comment,
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
    this.wsRegions.getRegions().forEach((r) => {
      const isSelected = r.id === id;
      r.setOptions({ color: isSelected ? COLOR_SELECTED : COLOR_DEFAULT });
      if (r.element) {
        r.element.classList.toggle("region-selected", isSelected);
      }
      this.applyZIndex(r);
    });
  }

  public setPlayheadTime(time: number) {
    if (this.playheadTime === time) return;
    this.playheadTime = time;
    this.wsRegions.getRegions().forEach((r) => this.applyZIndex(r));
  }

  public get(id: string) {
    return this.wsRegions.getRegions().find((r) => r.id === id);
  }

  public getAll() {
    return this.wsRegions.getRegions();
  }

  public selectNeighbor(direction: number) {
    const sorted = this.getAll().sort((a, b) => a.start - b.start);
    if (sorted.length === 0) return;

    const idx = sorted.findIndex((r) => r.id === this.selectedRegionId);
    if (idx === -1) {
      this.select(direction > 0 ? sorted[0].id : sorted[sorted.length - 1].id);
      return;
    }

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
