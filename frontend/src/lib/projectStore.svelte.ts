import { Api } from "./api";
import type { ProjectData, RegionChangeEvent } from "../types";

export class ProjectStore {
  current = $state<ProjectData | null>(null);
  audioUrl = $derived(
    this.current?.audio_file ? `/api/audio/${this.current.audio_file}` : null,
  );

  async load(id: string) {
    this.current = await Api.projects.get(id);
  }

  async create() {
    this.current = await Api.projects.create("New Analysis");
  }

  async uploadAudio(file: File) {
    if (!this.current) return;
    const { filename } = await Api.audio.upload(file);
    this.current.audio_file = filename;
    await this.save();
  }

  async save() {
    if (!this.current) return;
    await Api.projects.save(this.current.id, this.current);
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
      this.current = data;

      // Optional: Auto-save to persist this imported project to backend immediately?
      // For now, we just load it into memory. User must click "Save" to persist.
    } catch (e) {
      console.error("Failed to import project:", e);
      alert("Error parsing JSON file");
    }
  }

  updateRegion(e: RegionChangeEvent | { action: "delete"; id: string }) {
    if (!this.current) return;

    if ("action" in e && e.action === "delete") {
      this.current.regions = this.current.regions.filter((r) => r.id !== e.id);
    } else {
      // Handle Add/Update logic here (same as your original code)
      const r = e as RegionChangeEvent;
      const idx = this.current.regions.findIndex((reg) => reg.id === r.id);
      const newRegion = {
        id: r.id,
        start: r.start,
        end: r.end,
        chord_symbol: r.content,
        octave: r.octave || 4,
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
}

export const projectStore = new ProjectStore();
