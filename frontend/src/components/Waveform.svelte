<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { WaveformController } from "../lib/WaveformController.svelte"; // Logic moved here
  import { Api } from "../lib/api";
  import type { ChordRegion, RegionChangeEvent } from "../types";
  import { Chord } from "@tonaljs/tonal";

  let { audioUrl, regionsData, onRegionChange } = $props<{
    audioUrl: string;
    regionsData: ChordRegion[];
    onRegionChange: (e: any) => void;
  }>();

  let container = $state<HTMLElement>();
  let controller: WaveformController;

  // Local UI state (Modals only)
  let aiResult = $state<{ notes: string[]; name: string } | null>(null);
  let editState = $state<{ id: string; value: string; octave: number } | null>(
    null,
  );

  onMount(() => {
    if (!container) return;
    controller = new WaveformController(container, onRegionChange);
    return () => controller.destroy();
  });

  // Reactive Sync
  $effect(() => {
    if (audioUrl) controller.load(audioUrl);
  });
  $effect(() => {
    if (regionsData) controller.syncRegions(regionsData);
  });

  // Exposed Actions
  export const playPause = () => controller.playPause();
  export const addRegionAtHead = () => controller.addRegion("C");

  export async function runAiDetection(settings: any) {
    if (!audioUrl) return;
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
    if (editState) return; // Don't intercept if editing
    controller.handleShortcut(e);
  }

  function saveEdit() {
    if (!editState) return;
    controller.updateRegionContent(
      editState.id,
      editState.value,
      editState.octave,
    );
    editState = null;
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="relative bg-gray-900 rounded p-4">
  <div bind:this={container} class="w-full min-h-[128px]"></div>

  <div class="flex justify-end mt-2">
    <input
      type="range"
      min="10"
      max="300"
      oninput={(e) => controller.setZoom(Number(e.currentTarget.value))}
      class="w-32 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
    />
  </div>

  {#if aiResult}
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-900/90 p-4 rounded-xl text-center pointer-events-none transition-opacity"
      class:opacity-0={controller.isPlaying}
    >
      <div class="font-bold text-xl">{aiResult.name}</div>
      <div class="font-mono text-sm text-gray-300">
        {aiResult.notes.join(" - ")}
      </div>
    </div>
  {/if}

  {#if editState}
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 p-6 rounded shadow-xl w-80">
        <h3 class="font-bold mb-4">Edit Chord</h3>
        <input
          bind:value={editState.value}
          class="w-full bg-gray-900 p-2 rounded mb-4"
        />
        <div class="flex justify-end gap-2">
          <button onclick={() => (editState = null)} class="text-gray-400"
            >Cancel</button
          >
          <button onclick={saveEdit} class="bg-blue-600 px-3 py-1 rounded"
            >Save</button
          >
        </div>
      </div>
    </div>
  {/if}
</div>
