import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { TimelineNote } from "../types";

const NOTE_COLOR = "color-mix(in srgb, var(--amber) 22%, transparent)";
const NOTE_COLOR_SELECTED = "color-mix(in srgb, var(--amber) 45%, transparent)";

export class NoteManager {
  private wsNotes: RegionsPlugin;
  public selectedNoteId: string | null = null;
  private onNoteChange: (event: any) => void;

  private readonly STICKY_NOTE_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>`;

  private createLabelElement(_text: string) {
    const wrapper = document.createElement("div");
    wrapper.className = "note-marker-content";

    const icon = document.createElement("div");
    icon.className = "note-icon-badge";
    icon.innerHTML = this.STICKY_NOTE_SVG;
    wrapper.appendChild(icon);

    return wrapper;
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
