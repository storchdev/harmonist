<script lang="ts">
  import { onMount, tick } from "svelte";
  import WaveSurfer from "wavesurfer.js";
  import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
  import type { Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
  import type { ChordRegion, RegionChangeEvent } from "../types";
  import { ChordPlayer } from "../lib/ChordPlayer";

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

    ws.on("audioprocess", (currentTime) => {
      if (!ws.isPlaying()) return;
      const activeRegions = regions.getRegions().filter((r) => {
        return r.start >= lastTime && r.start <= currentTime;
      });

      activeRegions.forEach((r) => {
        const cleanData = regionsData.find((d) => d.id === r.id);
        if (cleanData) {
          const duration = r.end - r.start;
          if (duration < 0.05) return;
          player.playChord(cleanData.chord_symbol, duration);
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

      // 1. Get all other regions
      const others = regions.getRegions().filter((r) => r.id !== region.id);

      let modified = false;

      // 2. Check collision against EVERY other region
      for (const other of others) {
        // Check for Overlap
        if (region.start < other.end && region.end > other.start) {
          // Determine relative position using center points
          const myCenter = (region.start + region.end) / 2;
          const otherCenter = (other.start + other.end) / 2;

          if (myCenter < otherCenter) {
            // I am on the LEFT. My Right Edge hit his Left Edge.
            // Clamp my end to his start.
            region.end = other.start;

            // If I got squashed too small, push my start back
            if (region.end - region.start < MIN_DURATION) {
              region.start = region.end - MIN_DURATION;
            }
          } else {
            // I am on the RIGHT. My Left Edge hit his Right Edge.
            // Clamp my start to his end.
            region.start = other.end;

            // If I got squashed too small, push my end out
            if (region.end - region.start < MIN_DURATION) {
              region.end = region.start + MIN_DURATION;
            }
          }
          modified = true;
        }
      }

      // 3. Force Visual Update if we clamped
      if (modified) {
        region.setOptions({ start: region.start, end: region.end });
      }

      // 4. Send Clean Data to Parent
      const originalData = regionsData.find((d) => d.id === region.id);
      // Use original symbol to fix "Object HTML" bug
      const contentSafe = originalData ? originalData.chord_symbol : "";

      if (onRegionChange && originalData) {
        onRegionChange({
          id: region.id,
          start: region.start,
          end: region.end,
          content: contentSafe,
        });
      }
    });

    // Reset dragging flag slightly after interaction ends
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

  // Sync Data -> Visuals
  $effect(() => {
    // Only re-render if we are NOT dragging.
    // This prevents the parent's echo from stuttering our smooth drag.
    if (wsRegions && regionsData && isReady && !isEditing && !isDragging) {
      const visualCount = wsRegions.getRegions().length;
      // Simple check to see if we need a refresh
      if (visualCount !== regionsData.length || visualCount === 0) {
        renderVisualRegions();
      }
    }
  });

  // Zoom
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
    isEditing = true;
    contextMenu = null;
    await tick();
    editInputRef?.focus();
    editInputRef?.select();
  }

  function saveEdit() {
    if (!editId || !wsRegions) return;
    const region = wsRegions.getRegions().find((r) => r.id === editId);
    if (region) {
      region.setOptions({ content: editValue });
      if (onRegionChange) {
        onRegionChange({
          id: region.id,
          start: region.start,
          end: region.end,
          content: editValue,
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

    // LEFT / H
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "h") {
      if (wavesurfer) {
        if (e.key === "ArrowLeft") e.preventDefault();

        if (e.altKey && wsRegions) {
          const currentTime = wavesurfer.getCurrentTime();
          const sorted = wsRegions
            .getRegions()
            .sort((a, b) => a.start - b.start);
          const prev = sorted
            .slice()
            .reverse()
            .find((r) => r.start < currentTime - 0.05);
          if (prev) wavesurfer.setTime(prev.start);
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
          const sorted = wsRegions
            .getRegions()
            .sort((a, b) => a.start - b.start);
          const next = sorted.find((r) => r.start > currentTime + 0.05);
          if (next) wavesurfer.setTime(next.start);
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

  {#if isEditing}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        class="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-600 w-80"
      >
        <h3 class="text-lg font-bold mb-4 text-white">Edit Chord</h3>
        <input
          bind:this={editInputRef}
          bind:value={editValue}
          class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="e.g. Cm7"
        />
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
