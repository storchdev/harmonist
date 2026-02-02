import axios from "axios";
import type { ProjectData } from "../types";

const api = axios.create({ baseURL: "/api" });

export const Api = {
  projects: {
    list: async () => (await api.get<any[]>("/projects")).data,
    create: async (name: string) =>
      (await api.post<ProjectData>("/projects", { name })).data,
    get: async (id: string) =>
      (await api.get<ProjectData>(`/projects/${id}`)).data,
    save: async (id: string, data: ProjectData) =>
      await api.put(`/projects/${id}`, data),
  },
  audio: {
    upload: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post<{ filename: string }>("/upload", fd)).data;
    },
    identifyChord: async (filename: string, time: number, settings: any) => {
      const params = new URLSearchParams({
        filename,
        time: time.toString(),
        onset: settings.onset,
        frame: settings.frame,
        min_note_len: settings.minNoteLen,
      });
      return (await api.get(`/identify_chord?${params}`)).data;
    },
  },
};
