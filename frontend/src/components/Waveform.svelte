<script lang="ts">
  import { onDestroy, untrack, tick } from "svelte";
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
      event: RegionChangeEvent | { action: "delete"; id: string }
    ) => void;
  }>();

  // --- State ---
  let wavesurfer = $state<WaveSurfer | undefined>(undefined);
  let wsRegions = $state<RegionsPlugin | undefined>(undefined);
  let container = $state<HTMLElement | undefined>(undefined);

  let selectedRegionId = $state<string | null>(null);
  let contextMenu = $state<{ x: number; y: number; regionId: string } | null>(
    null
  );

  let player = new ChordPlayer(); // <--- Initialize Player
  let lastTime = 0; // Track time to detect crossings

  // Editing State
  let isEditing = $state(false);
  let editValue = $state("");
  let editId = $state<string | null>(null);
  let editInputRef = $state<HTMLInputElement | undefined>(undefined);

  // Constants
  const COLOR_DEFAULT = "rgba(59, 130, 246, 0.2)";
  const COLOR_SELECTED = "rgba(239, 68, 68, 0.4)";

  // --- Initialization ---
  $effect(() => {
    if (!container || untrack(() => wavesurfer)) return;

    const ws = WaveSurfer.create({
      container: container,
      waveColor: "#4b5563",
      progressColor: "#3b82f6",
      height: 128,
      normalize: true,
      minPxPerSec: 50,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());

    // 1. Update/Drag
    // Inside the $effect block:
    regions.on("region-double-clicked", (region: Region, e: MouseEvent) => {
      e.stopPropagation();
      startEditing(region.id); // No longer passing region.content
    });

    // 2. Click (Select)
    regions.on("region-clicked", (region: Region, e: MouseEvent) => {
      e.stopPropagation();
      selectRegion(region.id);
    });

    // 3. Double Click (Edit)
    regions.on("region-double-clicked", (region: Region, e: MouseEvent) => {
      e.stopPropagation();
      startEditing(region.id, region.content as string);
    });

    // 4. Background Click
    ws.on("click", () => {
      selectRegion(null);
    });

    // 5. Context Menu Binding (Right Click)
    regions.on("region-created", (region) => {
      if (region.element) {
        region.element.addEventListener("contextmenu", (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          selectRegion(region.id);
          contextMenu = { x: e.clientX, y: e.clientY, regionId: region.id };
        });
      }
    });

    // --- AUDIO SYNC LOGIC ---
    ws.on("audioprocess", (currentTime) => {
      if (!ws.isPlaying()) return;

      // Find regions that started between the last frame and now
      // We look at our PROPS (regionsData) because that is the source of truth,
      // though looking at wsRegions is also fine.
      // Let's use the local 'wsRegions' plugin instance for speed.

      const activeRegions = wsRegions!.getRegions().filter((r) => {
        // Check if this region's start time was crossed just now
        return r.start >= lastTime && r.start <= currentTime;
      });

      activeRegions.forEach((r) => {
        // FIX: Don't read r.content. Look up the clean data using ID.
        const cleanData = regionsData.find((d) => d.id === r.id);

        if (cleanData) {
          const chordName = cleanData.chord_symbol;
          const duration = r.end - r.start;

          // console.log(`Triggering ${chordName}`);
          player.playChord(chordName, duration);
        }
      });

      lastTime = currentTime;
    });

    // Handle Seeking (scrubbing): Reset lastTime so we don't trigger a backlog of chords
    ws.on("seeking", (currentTime) => {
      lastTime = currentTime;
      player.stopAll(); // Stop any lingering sound if we jump
    });

    // Handle Play: Ensure AudioContext is ready
    ws.on("play", () => {
      player.ensureReady();
    });

    wavesurfer = ws;
    wsRegions = regions;

    return () => {
      try {
        ws.destroy();
      } catch (e) {}
    };
  });

  // --- Reactivity: Audio ---
  $effect(() => {
    if (wavesurfer && audioUrl) wavesurfer.load(audioUrl);
  });

  // --- Reactivity: Regions ---
  $effect(() => {
    if (wsRegions && regionsData) {
      // Only clear if we aren't currently editing to prevent UI flicker
      if (isEditing) return;

      wsRegions.clearRegions();
      regionsData.forEach((r) => {
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
  });

  // --- Helpers ---

  function selectRegion(id: string | null) {
    selectedRegionId = id;
    contextMenu = null;
    if (!wsRegions) return;
    wsRegions.getRegions().forEach((r) => {
      r.setOptions({ color: r.id === id ? COLOR_SELECTED : COLOR_DEFAULT });
    });
  }

  function avoidOverlap(activeRegion: Region) {
    if (!wsRegions) return;
    const regions = wsRegions.getRegions().sort((a, b) => a.start - b.start);
    const index = regions.findIndex((r) => r.id === activeRegion.id);
    if (index === -1) return;

    const prev = regions[index - 1];
    const next = regions[index + 1];

    if (prev && activeRegion.start < prev.end) activeRegion.start = prev.end;
    if (next && activeRegion.end > next.start) activeRegion.end = next.start;
  }

  // --- Editing Logic ---

  // Find the 'startEditing' function and replace it with this:
  async function startEditing(id: string) {
    // FIX: Look up the clean chord name from our source of truth (regionsData),
    // instead of trusting the WaveSurfer region object which might be an HTML element.
    const sourceData = regionsData.find((r) => r.id === id);

    if (!sourceData) {
      console.error("Could not find region data for id:", id);
      return;
    }

    editId = id;
    editValue = sourceData.chord_symbol; // This is guaranteed to be the string "Cm7" etc.
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
      // 1. Update Visuals
      region.setOptions({ content: editValue });

      // 2. Notify Parent
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

  function handleKeyDown(e: KeyboardEvent) {
    if (isEditing) {
      if (e.key === "Enter") saveEdit();
      if (e.key === "Escape") closeEdit();
      e.stopPropagation(); // Prevent global delete from firing
      return;
    }

    if (selectedRegionId) {
      if (e.key === "Delete" || e.key === "Backspace")
        deleteRegion(selectedRegionId);
      if (e.key === "Enter") {
        startEditing(selectedRegionId);
      }
    }
  }

  // --- Public Methods ---
  export function playPause() {
    wavesurfer?.playPause();
  }

  export function addRegionAtCurrentTime(chordName: string) {
    // (Keep existing addRegion logic same as previous step...)
    // For brevity in this snippet, ensure you paste the "Overlap Check" version here
    if (!wavesurfer || !wsRegions) return;
    const currentTime = wavesurfer.getCurrentTime();
    const regions = wsRegions.getRegions().sort((a, b) => a.start - b.start);

    const inside = regions.find(
      (r) => currentTime >= r.start && currentTime < r.end - 0.01
    );
    if (inside) {
      selectRegion(inside.id);
      console.warn("Inside existing chord");
      return;
    }

    let duration = 2.0;
    const nextRegion = regions.find((r) => r.start > currentTime);
    if (nextRegion) {
      const gap = nextRegion.start - currentTime;
      if (gap < 0.1) return;
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

  export function setSynthVolume(val: number) {
    player.setVolume(val);
  }

  function deleteRegion(id: string) {
    if (onRegionChange) onRegionChange({ action: "delete", id: id });
    selectRegion(null);
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
        }}
      >
        Edit Chord
      </button>
      <button
        class="px-4 py-2 hover:bg-red-900/50 text-left text-red-300"
        onclick={() => deleteRegion(contextMenu!.regionId)}
      >
        Delete
      </button>
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
