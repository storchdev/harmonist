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

// The structure of the full save file
export interface ProjectData {
  id: string;
  name: string;
  audio_file: string | null;
  regions: ChordRegion[];
  notes: TimelineNote[];
  bpm: number;
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
