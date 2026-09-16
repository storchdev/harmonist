import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { TimelineNote } from "../types";

const NOTE_COLOR = "color-mix(in srgb, var(--amber) 22%, transparent)";
const NOTE_COLOR_SELECTED = "color-mix(in srgb, var(--amber) 45%, transparent)";

export class NoteManager {
  private wsNotes: RegionsPlugin;
  public selectedNoteId: string | null = null;
  private onNoteChange: (event: any) => void;

  private readonly labelStyle: Partial<CSSStyleDeclaration> = {
    position: "absolute",
    left: "0",
    top: "0",
    transform: "translate(-2px, -100%)",
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    border: "2px solid rgba(255, 255, 255, 0.22)",
    borderRadius: "999px",
    background:
      "color-mix(in srgb, color-mix(in srgb, black 45%, var(--amber) 30%) 68%, transparent)",
    backdropFilter: "blur(6px)",
    color: "#fff",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.55)",
    padding: "0.15rem 0.55rem",
    fontSize: "0.78rem",
    fontWeight: "600",
    lineHeight: "1.2",
    whiteSpace: "nowrap",
    maxWidth: "220px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
    cursor: "pointer",
    pointerEvents: "auto",
  };

  private createLabelElement(text: string) {
    const label = document.createElement("div");
    label.className = "note-label-chip";
    label.textContent = text || "Note";
    Object.assign(label.style, this.labelStyle);
    return label;
  }

  constructor(
    ws: WaveSurfer,
    callbacks: {
      onNoteChange: (event: any) => void;
      onEditNote: (id: string) => void;
      onShowContextMenu: (e: MouseEvent, id: string) => void;
    },
  ) {
    this.wsNotes = ws.registerPlugin(RegionsPlugin.create());
    this.onNoteChange = callbacks.onNoteChange;
    this.setupEvents(callbacks);
  }

  private setupEvents(cbs: any) {
    this.wsNotes.on("region-clicked", (note, e) => {
      e.stopPropagation();
      this.select(note.id);
    });

    this.wsNotes.on("region-double-clicked", (note, e) => {
      e.stopPropagation();
      cbs.onEditNote(note.id);
    });

    this.wsNotes.on("region-updated", (note) => {
      this.onNoteChange({ id: note.id, time: note.start, text: note.content });
    });

    this.wsNotes.on("region-created", (note) => {
      this.styleNoteElement(note);

      if (note.element) {
        note.element.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.select(note.id);
          cbs.onShowContextMenu(e, note.id);
        });
      }
    });
  }

  private styleNoteElement(note: any) {
    const isSelected = note.id === this.selectedNoteId;
    if (note.element) {
      note.element.classList.add("harmonist-note");
      note.element.classList.toggle("note-selected", isSelected);
      note.element.style.overflow = "visible";
      note.element.style.zIndex = isSelected ? "6" : "3";
    }
  }

  public sync(data: TimelineNote[]) {
    const current = this.wsNotes.getRegions();
    const byId = new Map(data.map((n) => [n.id, n]));
    const needsRebuild =
      current.length !== data.length ||
      current.some((n) => {
        const saved = byId.get(n.id);
        return !saved || saved.time !== n.start;
      });

    if (current.length === 0 || needsRebuild) {
      this.wsNotes.clearRegions();
      data.forEach((n) => {
        const r = this.wsNotes.addRegion({
          id: n.id,
          start: n.time,
          end: n.time,
          content: this.createLabelElement(n.text),
          color: n.id === this.selectedNoteId ? NOTE_COLOR_SELECTED : NOTE_COLOR,
          drag: true,
          resize: false,
        });
        this.styleNoteElement(r);
      });
    } else {
      current.forEach((note) => {
        const saved = byId.get(note.id);
        if (!saved) return;
        if (note.content instanceof HTMLElement) {
          note.content.textContent = saved.text || "Note";
        }
        this.styleNoteElement(note);
      });
    }
  }

  public add(time: number, text: string) {
    const r = this.wsNotes.addRegion({
      start: time,
      end: time,
      content: this.createLabelElement(text),
      color: NOTE_COLOR_SELECTED,
      drag: true,
      resize: false,
    });
    this.styleNoteElement(r);
    this.onNoteChange({ id: r.id, time: r.start, text });
    this.select(r.id);
    return r.id as string;
  }

  public updateContent(id: string, text: string) {
    const r = this.get(id);
    if (r) {
      r.setOptions({ content: this.createLabelElement(text) });
      this.styleNoteElement(r);
      this.onNoteChange({ id: r.id, time: r.start, text });
    }
  }

  public delete(id: string) {
    const r = this.get(id);
    if (r) {
      r.remove();
      this.onNoteChange({ action: "delete", id });
      this.select(null);
    }
  }

  public select(id: string | null) {
    this.selectedNoteId = id;
    this.wsNotes.getRegions().forEach((r) => {
      const isSelected = r.id === id;
      r.setOptions({ color: isSelected ? NOTE_COLOR_SELECTED : NOTE_COLOR });
      this.styleNoteElement(r);
    });
  }

  public get(id: string) {
    return this.wsNotes.getRegions().find((r) => r.id === id);
  }

  public getAll() {
    return this.wsNotes.getRegions();
  }
}
