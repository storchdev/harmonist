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

  let aiResult = $state<{ notes: string[]; name: string } | null>(null);
  let editState = $state<{ id: string; value: string; octave: number } | null>(
    null,
  );

  onMount(() => {
    if (!container) return;
    controller = new WaveformController(
      container,
      onRegionChange,
      () => {
        aiResult = null;
      }, // Clear AI on interaction
    );
    return () => controller?.destroy();
  });

  // Sync Logic
  $effect(() => {
    if (controller && audioUrl) controller.load(audioUrl);
  });

  $effect(() => {
    if (controller && regionsData) controller.syncRegions(regionsData);
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
    if (editState) return;
    controller?.handleShortcut(e);
  }

  function saveEdit() {
    if (!editState || !controller) return;
    controller.updateRegionContent(
      editState.id,
      editState.value,
      editState.octave,
    );
    editState = null;
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
      oninput={(e) => controller?.setZoom(Number(e.currentTarget.value))}
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
        <input
          bind:value={editState.value}
          class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="e.g. Cm7"
        />

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
</div>
