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

type ClipboardEntry = {
  offset: number;
  duration: number;
  chordSymbol: string;
  comment?: string;
};

export class RegionManager {
  private wsRegions: RegionsPlugin;
  public selectedRegionId: string | null = null;
  public selectedIds: Set<string> = new Set();
  private clipboard: ClipboardEntry[] = [];
  private onRegionChange: (event: any) => void;
  private playheadTime = 0;
  private defaultDuration = 2.0;
  private dragAnchorId: string | null = null;
  private dragSnapshot: Map<string, { start: number; end: number }> = new Map();

  private readonly labelStyle: Partial<CSSStyleDeclaration> = {
    // Centered on the region via left/top 50% + a translate transform,
    // sized to the chord chip alone (the comment below is positioned out
    // of flow — see commentLabelStyle — so a long comment can never widen
    // this box and drag the chord chip off-center with it).
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
    boxShadow: "0 3px 10px color-mix(in srgb, var(--amber) 45%, transparent)",
    whiteSpace: "nowrap",
  };

  private readonly commentLabelStyle: Partial<CSSStyleDeclaration> = {
    // Positioned out of flow, centered independently on the chord chip's
    // own box (not the other way around) — its width never affects the
    // chord chip's centering. See labelStyle.
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
      RegionLabelData | undefined;
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
    return this.selectedIds.has(region.id) || this.isOverPlayhead(region);
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
    const isSelected = this.selectedIds.has(region.id);

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
    // WaveSurfer's RegionsPlugin has a built-in avoidOverlapping() that
    // measures each region's content box against its neighbors and pushes
    // overlapping labels down via a dynamically-set marginTop. We want
    // labels always centered on their own region instead (overlap is
    // fine), so disable it — it otherwise fights our centering on every
    // region-created/update-end and produces visible drift.
    (this.wsRegions as any).avoidOverlapping = () => {};
    this.onRegionChange = callbacks.onRegionChange;

    this.setupEvents(callbacks);
  }

  private setupEvents(cbs: any) {
    // 1. Updates & Collisions
    this.wsRegions.on("region-update", (region, side) => {
      // side is undefined for a move, "start"/"end" for a resize handle drag
      if (side !== undefined) return;
      if (this.dragAnchorId !== region.id) return;
      const anchorSnap = this.dragSnapshot.get(region.id);
      if (!anchorSnap) return;
      const delta = region.start - anchorSnap.start;
      this.dragSnapshot.forEach((snap, id) => {
        if (id === region.id) return;
        const r = this.get(id);
        if (!r) return;
        r.setOptions({ start: snap.start + delta, end: snap.end + delta });
      });
    });

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

      if (this.dragAnchorId === region.id && this.dragSnapshot.size > 1) {
        this.dragSnapshot.forEach((_, id) => {
          if (id === region.id) return;
          const r = this.get(id);
          if (!r) return;
          const otherData = this.getRegionLabelData(r);
          this.onRegionChange({
            id: r.id,
            start: r.start,
            end: r.end,
            content: otherData.chordSymbol,
            comment: otherData.comment,
          });
        });
      }
      this.dragAnchorId = null;
      this.dragSnapshot = new Map();
    });

    // 2. Selection
    this.wsRegions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        this.toggleMultiSelect(region.id);
      } else {
        this.select(region.id);
      }
    });

    // 3. Interactions
    this.wsRegions.on("region-double-clicked", (region, e) => {
      e.stopPropagation();
      cbs.onEditRegion(region.id);
    });

    this.wsRegions.on("region-created", (region) => {
      this.styleRegionElement(region);

      if (region.element) {
        region.element.addEventListener("pointerdown", () => {
          if (this.selectedIds.has(region.id) && this.selectedIds.size > 1) {
            this.dragAnchorId = region.id;
            this.dragSnapshot = new Map(
              [...this.selectedIds].map((id) => {
                const r = this.get(id);
                return [id, { start: r?.start ?? 0, end: r?.end ?? 0 }];
              }),
            );
          }
        });

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
        return (
          !saved || saved.start !== region.start || saved.end !== region.end
        );
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
          color: this.selectedIds.has(r.id) ? COLOR_SELECTED : COLOR_DEFAULT,
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

    let dur = this.defaultDuration;
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
    this.selectedIds = id ? new Set([id]) : new Set();
    this.refreshSelectionStyles();
  }

  public toggleMultiSelect(id: string) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      if (this.selectedRegionId === id) {
        const remaining = [...this.selectedIds];
        this.selectedRegionId = remaining[remaining.length - 1] ?? null;
      }
    } else {
      this.selectedIds.add(id);
      this.selectedRegionId = id;
    }
    this.refreshSelectionStyles();
  }

  private refreshSelectionStyles() {
    this.wsRegions.getRegions().forEach((r) => {
      const isSelected = this.selectedIds.has(r.id);
      r.setOptions({ color: isSelected ? COLOR_SELECTED : COLOR_DEFAULT });
      if (r.element) {
        r.element.classList.toggle("region-selected", isSelected);
      }
      this.applyZIndex(r);
    });
  }

  public copySelected(): boolean {
    const selected = this.getAll().filter((r) => this.selectedIds.has(r.id));
    if (selected.length === 0) return false;

    const minStart = Math.min(...selected.map((r) => r.start));
    this.clipboard = selected.map((r) => {
      const data = this.getRegionLabelData(r);
      return {
        offset: r.start - minStart,
        duration: r.end - r.start,
        chordSymbol: data.chordSymbol,
        comment: data.comment,
      };
    });
    return true;
  }

  public pasteAt(time: number) {
    if (this.clipboard.length === 0) return;

    const newIds: string[] = [];
    this.clipboard.forEach((entry) => {
      const start = time + entry.offset;
      const end = start + entry.duration;
      const overlap = this.wsRegions
        .getRegions()
        .some((r) => start < r.end && end > r.start);
      if (overlap) return;

      const r = this.wsRegions.addRegion({
        start,
        end,
        content: this.createLabelElement({
          chordSymbol: entry.chordSymbol,
          comment: entry.comment,
        }),
        color: COLOR_DEFAULT,
      });
      this.styleRegionElement(r, {
        chordSymbol: entry.chordSymbol,
        comment: entry.comment,
      });
      this.onRegionChange({
        id: r.id,
        start: r.start,
        end: r.end,
        content: entry.chordSymbol,
        comment: entry.comment,
      });
      newIds.push(r.id);
    });

    if (newIds.length > 0) {
      this.selectedIds = new Set(newIds);
      this.selectedRegionId = newIds[newIds.length - 1];
      this.refreshSelectionStyles();
    }
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

  public selectNeighbor(direction: number, currentTime?: number) {
    const sorted = this.getAll().sort((a, b) => a.start - b.start);
    if (sorted.length === 0) return;

    const idx = sorted.findIndex((r) => r.id === this.selectedRegionId);
    if (idx === -1) {
      const t = currentTime ?? this.playheadTime;
      const closest = sorted.reduce((best, r) => {
        const center = (r.start + r.end) / 2;
        const bestCenter = (best.start + best.end) / 2;
        return Math.abs(center - t) < Math.abs(bestCenter - t) ? r : best;
      }, sorted[0]);
      this.select(closest.id);
      return;
    }

    const newIdx = (idx + direction + sorted.length) % sorted.length;
    this.select(sorted[newIdx].id);
  }

  public nudgeSelected(direction: number, mode: "move" | "resize", step = 0.1) {
    if (!this.selectedRegionId) return;

    if (mode === "move" && this.selectedIds.size > 1) {
      const delta = step * direction;
      const regions = [...this.selectedIds]
        .map((id) => this.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r);
      if (regions.some((r) => r.start + delta < 0)) return;

      regions.forEach((r) => {
        const newStart = r.start + delta;
        r.setOptions({ start: newStart, end: newStart + (r.end - r.start) });
        const labelData = this.getRegionLabelData(r);
        this.onRegionChange({
          id: r.id,
          start: r.start,
          end: r.end,
          content: labelData.chordSymbol,
          comment: labelData.comment,
        });
      });
      return;
    }

    const r = this.get(this.selectedRegionId);
    if (!r) return;

    if (mode === "move") {
      const newStart = r.start + step * direction;
      if (newStart < 0) return;
      r.setOptions({ start: newStart, end: newStart + (r.end - r.start) });
    } else {
      let newEnd = r.end + step * direction;
      if (newEnd - r.start < MIN_DURATION) newEnd = r.start + MIN_DURATION;
      r.setOptions({ end: newEnd });
    }

    const labelData = this.getRegionLabelData(r);
    this.onRegionChange({
      id: r.id,
      start: r.start,
      end: r.end,
      content: labelData.chordSymbol,
      comment: labelData.comment,
    });
  }

  public setDefaultDuration(duration: number) {
    this.defaultDuration = Math.max(MIN_DURATION, duration);
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
