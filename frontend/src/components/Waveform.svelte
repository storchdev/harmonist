<script lang="ts">
  import { onMount, tick } from "svelte";
  import WaveSurfer from "wavesurfer.js";
  import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
  import type { ChordRegion, RegionChangeEvent } from "../types";
  import { ChordPlayer } from "../lib/ChordPlayer";
  import { Chord } from "@tonaljs/tonal";

  // --- Props ---
  let {
    audioUrl = "",
    regionsData = [],
    onRegionChange,
  } = $props<{
    audioUrl?: string;
    regionsData?: ChordRegion[];
    onRegionChange?: (
      event: RegionChangeEvent | { action: "delete"; id: string },
    ) => void;
  }>();

  // --- State ---
  let wavesurfer = $state<WaveSurfer | undefined>(undefined);
  let wsRegions = $state<RegionsPlugin | undefined>(undefined);
  let container = $state<HTMLElement | undefined>(undefined);

  let isReady = $state(false);
  let zoomLevel = $state(50);
  let isDragging = $state(false);

  // AI Inspection State
  let aiResult = $state<{ notes: string[]; name: string } | null>(null);

  let selectedRegionId = $state<string | null>(null);
  let contextMenu = $state<{ x: number; y: number; regionId: string } | null>(
    null,
  );

  let player = new ChordPlayer();
  let lastTime = 0;

  // Edit State
  let isEditing = $state(false);
  let editValue = $state("");
  let editId = $state<string | null>(null);
  let editInputRef = $state<HTMLInputElement | undefined>(undefined);
  let isInvalid = $state(false);
  let editOctave = $state(4);

  const COLOR_DEFAULT = "rgba(59, 130, 246, 0.2)";
  const COLOR_SELECTED = "rgba(239, 68, 68, 0.4)";
  const MIN_DURATION = 0.1;

  // --- Lifecycle ---

  onMount(() => {
    if (!container) return;

    const ws = WaveSurfer.create({
      container: container,
      waveColor: "#4b5563",
      progressColor: "#3b82f6",
      height: 128,
      normalize: true,
      minPxPerSec: zoomLevel,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());

    // --- Events ---

    ws.on("decode", () => {
      isReady = true;
    });

    // 1. Clear AI Popup on movement
    ws.on("play", () => (aiResult = null));
    ws.on("seeking", () => (aiResult = null));

    ws.on("audioprocess", (currentTime) => {
      if (!ws.isPlaying()) return;
      const activeRegions = regions.getRegions().filter((r) => {
        return r.start >= lastTime + 0.1 && r.start <= currentTime + 0.1;
      });

      activeRegions.forEach((r) => {
        const cleanData = regionsData.find((d) => d.id === r.id);
        if (cleanData) {
          const duration = r.end - r.start;
          if (duration < 0.05) return;
          player.playChord(
            cleanData.chord_symbol,
            duration,
            cleanData.octave || 4,
          );
        }
      });
      lastTime = currentTime;
    });

    ws.on("play", () => player.ensureReady());
    ws.on("pause", () => player.stopAll());
    ws.on("seeking", (t) => {
      lastTime = t;
      player.stopAll();
    });

    // --- DRAG / COLLISION LOGIC ---

    regions.on("region-updated", (region) => {
      isDragging = true;

      const others = regions.getRegions().filter((r) => r.id !== region.id);
      let modified = false;

      for (const other of others) {
        if (region.start < other.end && region.end > other.start) {
          const myCenter = (region.start + region.end) / 2;
          const otherCenter = (other.start + other.end) / 2;

          if (myCenter < otherCenter) {
            region.end = other.start;
            if (region.end - region.start < MIN_DURATION) {
              region.start = region.end - MIN_DURATION;
            }
          } else {
            region.start = other.end;
            if (region.end - region.start < MIN_DURATION) {
              region.end = region.start + MIN_DURATION;
            }
          }
          modified = true;
        }
      }

      if (modified) {
        region.setOptions({ start: region.start, end: region.end });
      }

      const originalData = regionsData.find((d) => d.id === region.id);
      const contentSafe = originalData ? originalData.chord_symbol : "";

      if (onRegionChange && originalData) {
        onRegionChange({
          id: region.id,
          start: region.start,
          end: region.end,
          content: contentSafe,
          octave: originalData.octave, // preserve octave
        });
      }
    });

    ws.on("interaction", () => {
      setTimeout(() => {
        isDragging = false;
      }, 100);
    });

    regions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      isDragging = false;
      selectRegion(region.id);
    });

    regions.on("region-double-clicked", (region, e) => {
      e.stopPropagation();
      startEditing(region.id);
    });

    regions.on("region-created", (region) => {
      if (region.element) {
        region.element.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectRegion(region.id);
          contextMenu = { x: e.clientX, y: e.clientY, regionId: region.id };
        });
      }
    });

    ws.on("click", () => selectRegion(null));

    wavesurfer = ws;
    wsRegions = regions;

    return () => {
      player.stopAll();
      ws.destroy();
    };
  });

  // --- Reactivity ---

  $effect(() => {
    if (wavesurfer && audioUrl) {
      isReady = false;
      wavesurfer.load(audioUrl).catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    }
  });

  $effect(() => {
    if (wsRegions && regionsData && isReady && !isEditing && !isDragging) {
      const visualCount = wsRegions.getRegions().length;
      if (visualCount !== regionsData.length || visualCount === 0) {
        renderVisualRegions();
      }
    }
  });

  $effect(() => {
    if (wavesurfer && isReady) {
      wavesurfer.zoom(zoomLevel);
    }
  });

  function renderVisualRegions() {
    if (!wsRegions || !regionsData) return;
    wsRegions.clearRegions();
    regionsData.forEach((r) => {
      if (r.end - r.start < MIN_DURATION) return;
      wsRegions!.addRegion({
        id: r.id,
        start: r.start,
        end: r.end,
        content: r.chord_symbol,
        color: r.id === selectedRegionId ? COLOR_SELECTED : COLOR_DEFAULT,
        drag: true,
        resize: true,
      });
    });
  }

  // --- AI Logic ---

  export async function askAiForChord(settings?: {
    onset: number;
    frame: number;
    minNoteLen: number;
  }) {
    if (!wavesurfer || !audioUrl) return;

    const currentTime = wavesurfer.getCurrentTime();
    const filename = audioUrl.split("/").pop();
    if (!filename) return;

    // BUILD QUERY STRING
    let query = `filename=${filename}&time=${currentTime}`;
    if (settings) {
      query += `&onset=${settings.onset}&frame=${settings.frame}&min_note_len=${settings.minNoteLen}`;
    }

    try {
      const res = await fetch(
        `http://127.0.0.1:5000/api/identify_chord?${query}`,
      );
      const data = await res.json();

      // ... rest of the function remains identical ...
      if (data.notes && data.notes.length > 0) {
        const potentialChords = Chord.detect(data.notes);
        const name =
          potentialChords.length > 0 ? potentialChords[0] : "Unknown Shape";
        aiResult = { notes: data.notes, name: name };
      } else {
        aiResult = { notes: [], name: "Silence / No Chord" };
      }
    } catch (err) {
      console.error("AI Error:", err);
      aiResult = null;
    }
  }

  // --- Helpers ---

  function selectRegion(id: string | null) {
    selectedRegionId = id;
    contextMenu = null;
    if (!wsRegions) return;
    wsRegions.getRegions().forEach((r) => {
      r.setOptions({ color: r.id === id ? COLOR_SELECTED : COLOR_DEFAULT });
    });
  }

  // --- Editing ---

  async function startEditing(id: string) {
    const sourceData = regionsData.find((r) => r.id === id);
    if (!sourceData) return;
    editId = id;
    editValue = sourceData.chord_symbol;
    editOctave = sourceData.octave || 4;
    isEditing = true;
    isInvalid = false;
    contextMenu = null;
    await tick();
    editInputRef?.focus();
    editInputRef?.select();
  }

  function saveEdit() {
    if (!editId || !wsRegions) return;

    // VALIDATION
    let isValid = true;
    const cleanValue = editValue.trim();

    if (cleanValue.includes("/")) {
      const parts = cleanValue.split("/");
      const parsedChord = Chord.get(parts[0]);
      // Tonal's Note.get returns { empty: boolean }
      // We must ensure the bass note is valid, not empty
      // Tonal < 3.0 uses .empty, newer might use .isEmpty.
      // Note.get("C") -> { name: "C", ... empty: false }
      const parsedBass = Chord.get(parts[1]); // Trick: Chord.get works on single notes too or use Note.get logic if imported

      // Actually, let's stick to the previous robust Note check via Chord or simple regex if Import is tricky.
      // But since we removed Note import in this specific snippet to keep it clean, let's use Chord.get for safety
      if (
        parsedChord.empty ||
        !parsedChord.tonic ||
        Chord.get(parts[1]).empty
      ) {
        isValid = false;
      }
    } else {
      const parsed = Chord.get(cleanValue);
      if (parsed.empty || !parsed.tonic) isValid = false;
    }

    if (!isValid) {
      isInvalid = true;
      return;
    }

    const region = wsRegions.getRegions().find((r) => r.id === editId);
    if (region) {
      region.setOptions({ content: cleanValue });
      if (onRegionChange) {
        onRegionChange({
          id: region.id,
          start: region.start,
          end: region.end,
          content: cleanValue,
          octave: editOctave,
        });
      }
    }
    closeEdit();
  }

  function closeEdit() {
    isEditing = false;
    editId = null;
  }

  function deleteRegion(id: string) {
    if (onRegionChange) onRegionChange({ action: "delete", id: id });
    selectRegion(null);
  }

  // --- Global Inputs ---

  function handleKeyDown(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      if (!isEditing) return;
    }

    if (isEditing) {
      if (e.key === "Enter") saveEdit();
      if (e.key === "Escape") closeEdit();
      e.stopPropagation();
      return;
    }

    const SHIFT_JUMP = 5.0;
    const NORMAL_JUMP = 0.5;
    const jumpAmount = e.shiftKey ? SHIFT_JUMP : NORMAL_JUMP;

    // Helper: All Boundaries
    const getBoundaries = () => {
      if (!wsRegions) return [];
      const times = wsRegions.getRegions().flatMap((r) => [r.start, r.end]);
      return [...new Set(times)].sort((a, b) => a - b);
    };

    // LEFT / H
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "h") {
      if (wavesurfer) {
        if (e.key === "ArrowLeft") e.preventDefault();

        if (e.altKey && wsRegions) {
          const currentTime = wavesurfer.getCurrentTime();
          const boundaries = getBoundaries();
          const prev = boundaries.reverse().find((t) => t < currentTime - 0.05);
          if (prev !== undefined) wavesurfer.setTime(prev);
          else wavesurfer.setTime(0);
        } else {
          const time = Math.max(0, wavesurfer.getCurrentTime() - jumpAmount);
          wavesurfer.setTime(time);
        }
      }
    }

    // RIGHT / L
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "l") {
      if (wavesurfer) {
        if (e.key === "ArrowRight") e.preventDefault();

        if (e.altKey && wsRegions) {
          const currentTime = wavesurfer.getCurrentTime();
          const boundaries = getBoundaries();
          const next = boundaries.find((t) => t > currentTime + 0.05);
          if (next !== undefined) wavesurfer.setTime(next);
          else wavesurfer.setTime(wavesurfer.getDuration());
        } else {
          const time = Math.min(
            wavesurfer.getDuration(),
            wavesurfer.getCurrentTime() + jumpAmount,
          );
          wavesurfer.setTime(time);
        }
      }
    }

    if (e.code === "Space") {
      e.preventDefault();
      wavesurfer?.playPause();
      return;
    }

    if (e.code === "KeyM") {
      addRegionAtCurrentTime("C");
      return;
    }

    if (selectedRegionId) {
      if (e.key === "Delete" || e.key === "Backspace")
        deleteRegion(selectedRegionId);
      if (e.key === "Enter") startEditing(selectedRegionId);
    }
  }

  // --- Exports ---

  export function playPause() {
    wavesurfer?.playPause();
  }
  export function setSynthVolume(val: number) {
    player.setVolume(val);
  }
  export function setOscillator(type: any) {
    player.setOscillatorType(type);
  }

  export function addRegionAtCurrentTime(chordName: string) {
    if (!wavesurfer || !wsRegions) return;

    if (regionsData.length > 0 && wsRegions.getRegions().length === 0) {
      renderVisualRegions();
    }

    const currentTime = wavesurfer.getCurrentTime();
    const regions = wsRegions.getRegions().sort((a, b) => a.start - b.start);

    const inside = regions.find(
      (r) => currentTime >= r.start && currentTime < r.end - 0.01,
    );
    if (inside) {
      selectRegion(inside.id);
      return;
    }

    let duration = 2.0;
    const nextRegion = regions.find((r) => r.start > currentTime);
    if (nextRegion) {
      const gap = nextRegion.start - currentTime;
      if (gap < MIN_DURATION) return;
      duration = Math.min(duration, gap);
    }

    const newRegion = wsRegions.addRegion({
      start: currentTime,
      end: currentTime + duration,
      content: chordName,
      color: COLOR_SELECTED,
      drag: true,
      resize: true,
    });
    selectRegion(newRegion.id);

    if (onRegionChange) {
      onRegionChange({
        id: newRegion.id,
        start: newRegion.start,
        end: newRegion.end,
        content: chordName,
      });
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  class="w-full bg-gray-900 rounded-lg p-4 shadow-inner relative flex flex-col gap-2"
>
  <div bind:this={container} class="w-full min-h-[128px]"></div>

  <div class="flex justify-end items-center gap-2 px-2">
    <span class="text-[10px] text-gray-500 uppercase font-bold">Zoom</span>
    <input
      type="range"
      min="10"
      max="300"
      bind:value={zoomLevel}
      class="w-32 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
    />
  </div>

  {#if aiResult}
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div
        class="bg-indigo-900/90 backdrop-blur border border-indigo-400 text-white px-6 py-3 rounded-xl shadow-2xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <span
          class="text-xs text-indigo-300 uppercase font-bold tracking-widest mb-1"
          >AI Detected</span
        >
        <div class="text-2xl font-bold">{aiResult.name}</div>
        <div class="text-sm text-gray-300 mt-1 font-mono opacity-80">
          {aiResult.notes.join(" - ")}
        </div>
      </div>
    </div>
  {/if}

  {#if isEditing}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        class="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-600 w-80"
      >
        <h3 class="text-lg font-bold mb-4 text-white">Edit Chord</h3>

        <div class="mb-4">
          <label class="text-xs text-gray-400 uppercase font-bold block mb-1"
            >Symbol</label
          >
          <input
            bind:this={editInputRef}
            bind:value={editValue}
            oninput={() => (isInvalid = false)}
            class="w-full bg-gray-900 border rounded p-2 text-white outline-none transition-colors
                     {isInvalid
              ? 'border-red-500 focus:ring-2 focus:ring-red-500'
              : 'border-gray-600 focus:ring-2 focus:ring-blue-500'}"
            placeholder="e.g. Cm7"
          />
          {#if isInvalid}
            <p class="text-red-400 text-xs mt-1">Invalid chord name</p>
          {/if}
        </div>

        <div class="mb-6">
          <div class="flex justify-between mb-1">
            <label class="text-xs text-gray-400 uppercase font-bold"
              >Octave</label
            >
            <span class="text-xs text-blue-400 font-bold">{editOctave}</span>
          </div>
          <input
            type="range"
            min="2"
            max="6"
            step="1"
            bind:value={editOctave}
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div class="flex justify-end gap-2">
          <button
            class="px-3 py-1 text-sm text-gray-400 hover:text-white"
            onclick={closeEdit}>Cancel</button
          >
          <button
            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onclick={saveEdit}>Save</button
          >
        </div>
      </div>
    </div>
  {/if}

  {#if contextMenu}
    <div
      class="fixed bg-gray-800 border border-gray-600 shadow-xl rounded z-50 text-sm flex flex-col py-1"
      style="top: {contextMenu.y}px; left: {contextMenu.x}px"
    >
      <button
        class="px-4 py-2 hover:bg-gray-700 text-left text-white"
        onclick={() => {
          if (contextMenu) startEditing(contextMenu.regionId);
        }}>Edit Chord</button
      >
      <button
        class="px-4 py-2 hover:bg-red-900/50 text-left text-red-300"
        onclick={() => deleteRegion(contextMenu!.regionId)}>Delete</button
      >
    </div>
    <div
      class="fixed inset-0 z-40"
      onclick={() => (contextMenu = null)}
      oncontextmenu={(e) => {
        e.preventDefault();
        contextMenu = null;
      }}
    ></div>
  {/if}
</div>
