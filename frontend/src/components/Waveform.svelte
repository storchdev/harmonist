<script lang="ts">
  import { onMount } from "svelte";
  import { WaveformController } from "../lib/WaveformController.svelte";
  import { Api } from "../lib/api";
  import type { ChordRegion } from "../types";
  import { Chord } from "@tonaljs/tonal";

  let { audioUrl, regionsData, onRegionChange } = $props<{
    audioUrl: string;
    regionsData: ChordRegion[];
    onRegionChange: (e: any) => void;
  }>();

  let container = $state<HTMLElement>();
  let controller = $state<WaveformController>();

  // UI States
  let aiResult = $state<{ notes: string[]; name: string } | null>(null);
  let editState = $state<{ id: string; value: string; octave: number } | null>(
    null,
  );
  let contextMenu = $state<{ x: number; y: number; regionId: string } | null>(
    null,
  );
  let currentZoom = $state(50);

  // Validation State
  let isInvalid = $state(false);

  onMount(() => {
    if (!container) return;

    controller = new WaveformController(container, {
      onRegionChange: (e) => onRegionChange(e),
      onUserInteraction: () => {
        aiResult = null;
        contextMenu = null;
      },
      onShowContextMenu: (e, id) => {
        contextMenu = { x: e.clientX, y: e.clientY, regionId: id };
      },
      onEditRegion: (id) => startEditing(id),
    });

    return () => controller?.destroy();
  });

  $effect(() => {
    if (controller && audioUrl) controller.load(audioUrl);
  });
  $effect(() => {
    if (controller && controller.isReady && regionsData)
      controller.syncRegions(regionsData);
  });

  // Public Actions
  export const playPause = () => controller?.playPause();
  export const addRegionAtCurrentTime = (c: string) => controller?.addRegion(c);
  export const setSynthVolume = (v: number) => controller?.setSynthVolume(v);
  export const setOscillator = (t: string) => controller?.setOscillator(t);

  export async function askAiForChord(settings: any) {
    if (!audioUrl || !controller) return;
    const time = controller.getCurrentTime();
    const filename = audioUrl.split("/").pop()!;
    try {
      const data = await Api.audio.identifyChord(filename, time, settings);
      const name = data.notes.length
        ? Chord.detect(data.notes)[0] || "Unknown"
        : "Silence";
      aiResult = { notes: data.notes, name };
    } catch (e) {
      console.error(e);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (editState) {
      if (e.key === "Enter") saveEdit(); // Quick save
      return;
    }
    controller?.handleShortcut(e);
  }

  function startEditing(id: string) {
    const r = regionsData.find((reg) => reg.id === id);
    if (!r) return;
    editState = { id, value: r.chord_symbol, octave: r.octave || 4 };
    isInvalid = false; // Reset error
    contextMenu = null;
  }

  function saveEdit() {
    if (!editState || !controller) return;

    // --- Validation Logic ---
    let isValid = true;
    const cleanValue = editState.value.trim();

    if (cleanValue.includes("/")) {
      const parts = cleanValue.split("/");
      const parsedChord = Chord.get(parts[0]);
      // Tonal doesn't strictly separate Note.get and Chord.get for simple validation
      const parsedBass = Chord.get(parts[1]);

      if (parsedChord.empty || !parsedChord.tonic || parsedBass.empty) {
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
    // ------------------------

    controller.updateRegionContent(editState.id, cleanValue, editState.octave);
    editState = null;
  }

  function handleDeleteContext() {
    if (contextMenu && controller) {
      controller.deleteRegion(contextMenu.regionId);
      contextMenu = null;
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  class="relative w-full bg-gray-900 rounded-lg p-4 shadow-inner flex flex-col gap-2"
>
  <div bind:this={container} class="w-full min-h-[128px]"></div>

  <div class="flex justify-end items-center gap-2 px-2">
    <span class="text-[10px] text-gray-500 uppercase font-bold">Zoom</span>
    <input
      type="range"
      min="10"
      max="300"
      bind:value={currentZoom}
      oninput={() => controller?.setZoom(currentZoom)}
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

  {#if editState}
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onclick={(e) => e.stopPropagation()}
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
            bind:value={editState.value}
            oninput={() => (isInvalid = false)}
            class="w-full bg-gray-900 border rounded p-2 text-white outline-none transition-colors {isInvalid
              ? 'border-red-500 ring-1 ring-red-500'
              : 'border-gray-600 focus:ring-2 focus:ring-blue-500'}"
            placeholder="e.g. Cm7"
            autofocus
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
            <span class="text-xs text-blue-400 font-bold"
              >{editState.octave}</span
            >
          </div>
          <input
            type="range"
            min="2"
            max="6"
            step="1"
            bind:value={editState.octave}
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div class="flex justify-end gap-2">
          <button
            class="px-3 py-1 text-sm text-gray-400 hover:text-white"
            onclick={() => (editState = null)}>Cancel</button
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
      class="fixed bg-gray-800 border border-gray-600 shadow-xl rounded z-[100] text-sm flex flex-col py-1 min-w-[120px]"
      style="top: {contextMenu.y}px; left: {contextMenu.x}px"
    >
      <button
        class="px-4 py-2 hover:bg-gray-700 text-left text-white"
        onclick={() => startEditing(contextMenu!.regionId)}>Edit Chord</button
      >
      <button
        class="px-4 py-2 hover:bg-red-900/50 text-left text-red-300"
        onclick={handleDeleteContext}>Delete</button
      >
    </div>
    <div
      class="fixed inset-0 z-[99]"
      onclick={() => (contextMenu = null)}
      oncontextmenu={(e) => {
        e.preventDefault();
        contextMenu = null;
      }}
    ></div>
  {/if}
</div>
