import { Api } from "./api";
import {
  defaultEditorSettings,
  type ProjectData,
  type RegionChangeEvent,
  type TimelineNote,
} from "../types";

function withDefaults(data: ProjectData): ProjectData {
  if (!Array.isArray(data.notes)) data.notes = [];
  data.settings = {
    ...defaultEditorSettings(),
    ...data.settings,
    aiSettings: {
      ...defaultEditorSettings().aiSettings,
      ...data.settings?.aiSettings,
    },
  };
  return data;
}

export class ProjectStore {
  private readonly lastProjectKey = "harmonist:last-project-id";
  private readonly maxHistory = 50;
  current = $state<ProjectData | null>(null);
  dirty = $state(false);
  private history = $state<ProjectData["regions"][]>([]);
  audioUrl = $derived(
    this.current?.audio_file ? `/api/audio/${this.current.audio_file}` : null,
  );
  canUndo = $derived(this.history.length > 0);

  async load(id: string) {
    this.current = withDefaults(await Api.projects.get(id));
    this.history = [];
    this.dirty = false;
    localStorage.setItem(this.lastProjectKey, id);
  }

  async create() {
    this.current = withDefaults(await Api.projects.create("New Analysis"));
    this.history = [];
    this.dirty = false;
    localStorage.setItem(this.lastProjectKey, this.current.id);
  }

  async restoreLastProject() {
    const id = localStorage.getItem(this.lastProjectKey);
    if (!id) return;

    try {
      await this.load(id);
    } catch (error) {
      // The project may have been removed on another device or by the server.
      localStorage.removeItem(this.lastProjectKey);
      console.warn("Could not restore the last project", error);
    }
  }

  close() {
    this.current = null;
    this.history = [];
    this.dirty = false;
    localStorage.removeItem(this.lastProjectKey);
  }

  async uploadAudio(file: File) {
    if (!this.current) return;
    const { filename } = await Api.audio.upload(file);
    this.current.audio_file = filename;
    this.current.name = file.name.replace(/\.[^./]+$/, "");
    await this.save();
  }

  async save() {
    if (!this.current) return;
    await Api.projects.save(this.current.id, this.current);
    localStorage.setItem(this.lastProjectKey, this.current.id);
    this.dirty = false;
  }

  // --- NEW: Download JSON ---
  download() {
    if (!this.current) return;
    const json = JSON.stringify(this.current, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.current.name.replace(/\s+/g, "_")}_${this.current.id.slice(0, 4)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- NEW: Import JSON ---
  async importFile(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ProjectData;

      // Basic validation
      if (!data.id || !Array.isArray(data.regions)) {
        throw new Error("Invalid project JSON structure");
      }

      // Load into state immediately
      this.current = withDefaults(data);
      this.history = [];
      this.dirty = true;

      // Optional: Auto-save to persist this imported project to backend immediately?
      // For now, we just load it into memory. User must click "Save" to persist.
    } catch (e) {
      console.error("Failed to import project:", e);
      alert("Error parsing JSON file");
    }
  }

  private snapshotHistory() {
    if (!this.current) return;
    this.history.push(structuredClone(this.current.regions));
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  undo() {
    if (!this.current || this.history.length === 0) return;
    this.current.regions = this.history.pop()!;
    this.dirty = true;
  }

  updateRegion(e: RegionChangeEvent | { action: "delete"; id: string }) {
    if (!this.current) return;
    this.snapshotHistory();
    this.dirty = true;

    if ("action" in e && e.action === "delete") {
      this.current.regions = this.current.regions.filter((r) => r.id !== e.id);
    } else {
      // Handle Add/Update logic here (same as your original code)
      const r = e as RegionChangeEvent;
      const idx = this.current.regions.findIndex((reg) => reg.id === r.id);
      const existing = idx >= 0 ? this.current.regions[idx] : null;
      const trimmedComment = r.comment?.trim();
      const newRegion = {
        id: r.id,
        start: r.start,
        end: r.end,
        chord_symbol: r.content,
        octave: r.octave ?? existing?.octave ?? 4,
        comment:
          r.comment !== undefined
            ? (trimmedComment || undefined)
            : existing?.comment,
      };

      if (idx >= 0)
        this.current.regions[idx] = {
          ...this.current.regions[idx],
          ...newRegion,
        };
      else this.current.regions.push(newRegion);

      this.current.regions.sort((a, b) => a.start - b.start);
    }
  }

  addNote(time: number, text: string) {
    if (!this.current) return;
    const note: TimelineNote = { id: crypto.randomUUID(), time, text };
    this.current.notes.push(note);
    this.current.notes.sort((a, b) => a.time - b.time);
    this.dirty = true;
    return note;
  }

  updateNote(id: string, text: string) {
    if (!this.current) return;
    const note = this.current.notes.find((n) => n.id === id);
    if (note) note.text = text;
    this.dirty = true;
  }

  deleteNote(id: string) {
    if (!this.current) return;
    this.current.notes = this.current.notes.filter((n) => n.id !== id);
    this.dirty = true;
  }
}

export const projectStore = new ProjectStore();
