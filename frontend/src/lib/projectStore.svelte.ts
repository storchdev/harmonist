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
