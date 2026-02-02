<script lang="ts">
  import { projectStore } from "./lib/projectStore.svelte";
  import { Api } from "./lib/api";
  import Waveform from "./components/Waveform.svelte";

  // You should move sub-components (LoadMenu, AiSettings) to their own files
  // For brevity, we keep basic UI logic here but rely on the store.

  let showLoadMenu = $state(false);
  let projectList = $state<{ id: string; name: string }[]>([]);
  let showAiSettings = $state(false);
  let waveformRef = $state<Waveform>(); // Access to child

  // AI Settings State
  let aiSettings = $state({ onset: 0.6, frame: 0.4, minNoteLen: 100 });
  let isAiLoading = $state(false);

  async function openLoadMenu() {
    projectList = await Api.projects.list();
    showLoadMenu = true;
  }

  async function triggerAi() {
    if (!waveformRef) return;
    isAiLoading = true;
    try {
      await waveformRef.runAiDetection(aiSettings);
    } finally {
      isAiLoading = false;
    }
  }
</script>

<main class="min-h-screen bg-gray-800 text-white p-8">
  <h1 class="text-3xl font-bold mb-6">Harmonist</h1>

  {#if !projectStore.current}
    <div class="flex gap-4">
      <button class="btn-primary" onclick={() => projectStore.create()}
        >New Project</button
      >
      <button class="btn-secondary" onclick={openLoadMenu}>Load Existing</button
      >
    </div>

    {#if showLoadMenu}
      <div
        class="mt-8 bg-gray-900 p-6 rounded-lg max-w-md border border-gray-700"
      >
        <h2 class="text-xl mb-4 font-bold text-gray-300">Select Project</h2>
        {#each projectList as p}
          <button
            class="block w-full text-left p-2 hover:bg-gray-800"
            onclick={() => {
              projectStore.load(p.id);
              showLoadMenu = false;
            }}
          >
            {p.name}
          </button>
        {/each}
        <button
          class="mt-4 text-sm text-gray-400"
          onclick={() => (showLoadMenu = false)}>Cancel</button
        >
      </div>
    {/if}
  {:else}
    <div class="mb-6 flex gap-4 items-center bg-gray-900 p-4 rounded-lg">
      <input
        type="text"
        bind:value={projectStore.current.name}
        class="bg-transparent text-xl font-bold border-b border-gray-700 w-64"
      />

      <div class="flex flex-col">
        <span class="text-xs text-gray-500 font-bold">AUDIO</span>
        {#if projectStore.current.audio_file}
          <span class="text-sm text-green-400"
            >{projectStore.current.audio_file}</span
          >
        {:else}
          <input
            type="file"
            onchange={(e) =>
              projectStore.uploadAudio(
                (e.target as HTMLInputElement).files![0],
              )}
          />
        {/if}
      </div>

      <div class="flex-grow"></div>
      <button class="btn-green" onclick={() => projectStore.save()}
        >Save Project</button
      >
      <button class="btn-red" onclick={() => (projectStore.current = null)}
        >Close</button
      >
    </div>

    <Waveform
      bind:this={waveformRef}
      audioUrl={projectStore.audioUrl || ""}
      regionsData={projectStore.current.regions}
      onRegionChange={(e) => projectStore.updateRegion(e)}
    />

    <div class="flex gap-4 p-4 bg-gray-900 rounded-lg items-center mt-4">
      <button class="btn-gray" onclick={() => waveformRef?.playPause()}
        >Play / Pause</button
      >
      <button class="btn-purple" onclick={() => waveformRef?.addRegionAtHead()}
        >Add Chord</button
      >

      <button class="btn-indigo flex items-center gap-2" onclick={triggerAi}>
        {#if isAiLoading}
          <span class="animate-spin">⌛</span>
        {/if} <span>AI Identify</span>
      </button>

      <button
        class="btn-icon"
        onclick={() => (showAiSettings = !showAiSettings)}>⚙️</button
      >

      {#if showAiSettings}
        <div
          class="absolute bg-gray-800 p-4 border rounded shadow-xl mt-12 z-50"
        >
          <label
            >Sensitivity: <input
              type="range"
              bind:value={aiSettings.onset}
              min="0.1"
              max="0.9"
              step="0.05"
            /></label
          >
        </div>
      {/if}
    </div>
  {/if}
</main>

<style>
  @import "tailwindcss";
  /* Utility classes for buttons to clean up HTML */
  .btn-primary {
    @apply bg-blue-600 px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold;
  }
  .btn-secondary {
    @apply bg-gray-600 px-6 py-3 rounded-lg hover:bg-gray-700 font-semibold;
  }
  .btn-green {
    @apply bg-green-600 px-4 py-2 rounded hover:bg-green-700;
  }
  .btn-red {
    @apply bg-red-900/50 text-red-200 px-4 py-2 rounded hover:bg-red-900;
  }
  .btn-gray {
    @apply bg-gray-700 px-6 py-2 rounded hover:bg-gray-600 font-medium;
  }
  .btn-purple {
    @apply bg-purple-600 px-6 py-2 rounded hover:bg-purple-700 font-medium;
  }
  .btn-indigo {
    @apply bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 font-medium;
  }
</style>
