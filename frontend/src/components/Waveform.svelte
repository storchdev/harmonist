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

  // FIX: Track if audio is actually ready to accept regions
  let isReady = $state(false);

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
      minPxPerSec: 50,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());

    // --- Events ---

    // 1. Wait for decode before allowing regions to render
    ws.on("decode", () => {
      console.log("Audio decoded. Ready to render.");
      isReady = true; // This triggers the effect to draw regions
    });

    // 2. Audio Processing
    ws.on("audioprocess", (currentTime) => {
      if (!ws.isPlaying()) return;

      const activeRegions = regions.getRegions().filter((r) => {
        return r.start >= lastTime && r.start <= currentTime;
      });

      activeRegions.forEach((r) => {
        const cleanData = regionsData.find((d) => d.id === r.id);
        if (cleanData) {
          const duration = r.end - r.start;
          // Safeguard: strictly ignore micro-regions (remnants of the clamping bug)
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

    regions.on("region-updated", (region) => {
      avoidOverlap(region, regions);
      if (onRegionChange) {
        onRegionChange({
          id: region.id,
          start: region.start,
          end: region.end,
          content: region.content as string,
        });
      }
    });

    regions.on("region-clicked", (region, e) => {
      e.stopPropagation();
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

  // Load Audio
  $effect(() => {
    if (wavesurfer && audioUrl) {
      // Reset ready state when loading new audio
      isReady = false;
      wavesurfer.load(audioUrl).catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    }
  });

  // Sync Regions
  $effect(() => {
    // FIX: Only render if wsRegions exists AND audio isReady
    if (wsRegions && regionsData && isReady && !isEditing) {
      const visualCount = wsRegions.getRegions().length;
      // Force sync if counts mismatch or empty
      if (visualCount !== regionsData.length || visualCount === 0) {
        renderVisualRegions();
      }
    }
  });

  function renderVisualRegions() {
    if (!wsRegions || !regionsData) return;

    console.log(`Rendering ${regionsData.length} regions...`);
    wsRegions.clearRegions();

    regionsData.forEach((r) => {
      // Double check we aren't rendering corrupt data
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

  // --- Helpers (Same as before) ---

  function selectRegion(id: string | null) {
    selectedRegionId = id;
    contextMenu = null;
    if (!wsRegions) return;
    wsRegions.getRegions().forEach((r) => {
      r.setOptions({ color: r.id === id ? COLOR_SELECTED : COLOR_DEFAULT });
    });
  }

  function avoidOverlap(activeRegion: Region, regionsPlugin: RegionsPlugin) {
    const regions = regionsPlugin
      .getRegions()
      .sort((a, b) => a.start - b.start);
    const index = regions.findIndex((r) => r.id === activeRegion.id);
    if (index === -1) return;

    const prev = regions[index - 1];
    const next = regions[index + 1];

    if (prev && activeRegion.start < prev.end) {
      activeRegion.start = prev.end;
      if (activeRegion.end - activeRegion.start < MIN_DURATION) {
        activeRegion.end = activeRegion.start + MIN_DURATION;
      }
    }

    if (next && activeRegion.end > next.start) {
      activeRegion.end = next.start;
      if (activeRegion.end - activeRegion.start < MIN_DURATION) {
        activeRegion.start = activeRegion.end - MIN_DURATION;
      }
    }
  }

  // --- Editing (Same as before) ---

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

  // --- Global Inputs (Same as before) ---

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

    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "h") {
      if (wavesurfer) {
        if (e.key === "ArrowLeft") e.preventDefault();
        const time = Math.max(0, wavesurfer.getCurrentTime() - jumpAmount);
        wavesurfer.setTime(time);
      }
    }

    if (e.key === "ArrowRight" || e.key.toLowerCase() === "l") {
      if (wavesurfer) {
        if (e.key === "ArrowRight") e.preventDefault();
        const time = Math.min(
          wavesurfer.getDuration(),
          wavesurfer.getCurrentTime() + jumpAmount,
        );
        wavesurfer.setTime(time);
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

  // --- Exports (Same as before) ---

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

<div class="w-full bg-gray-900 rounded-lg p-4 shadow-inner relative">
  <div bind:this={container} class="w-full min-h-[128px]"></div>

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
