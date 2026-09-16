// src/types.ts

// The structure of a single chord marker
export interface ChordRegion {
  id: string;
  start: number;
  end: number;
  chord_symbol: string;
  octave?: number;
  comment?: string;
}

// A point-in-time annotation that doesn't occupy a duration on the timeline
export interface TimelineNote {
  id: string;
  time: number;
  text: string;
}

// Editor/UI preferences that travel with the project rather than the browser.
export interface EditorSettings {
  zoom: number;
  scrollPosition: number;
  synthVolume: number;
  trackVolume: number;
  synthMuted: boolean;
  trackMuted: boolean;
  oscillator: string;
  aiSettings: { onset: number; frame: number; minNoteLen: number };
}

export function defaultEditorSettings(): EditorSettings {
  return {
    zoom: 50,
    scrollPosition: 0,
    synthVolume: -10,
    trackVolume: 1,
    synthMuted: false,
    trackMuted: false,
    oscillator: "triangle",
    aiSettings: { onset: 0.6, frame: 0.4, minNoteLen: 100 },
  };
}

// The structure of the full save file
export interface ProjectData {
  id: string;
  name: string;
  audio_file: string | null;
  regions: ChordRegion[];
  notes: TimelineNote[];
  bpm: number;
  settings?: EditorSettings;
  last_modified?: string;
}

// Event payload when a region is modified in the UI
export interface RegionChangeEvent {
  id: string;
  start: number;
  end: number;
  content: string;
  octave?: number;
  comment?: string;
}
