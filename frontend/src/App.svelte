<script lang="ts">
  import { projectStore } from "./lib/projectStore.svelte";
  import { Api } from "./lib/api";
  import Waveform from "./components/Waveform.svelte";
  import AiSettings from "./components/AiSettings.svelte";

  let showLoadMenu = $state(false);
  let projectList = $state<{ id: string; name: string }[]>([]);
  let showAiSettings = $state(false);
  let waveformRef = $state<Waveform>();

  let aiSettings = $state({ onset: 0.6, frame: 0.4, minNoteLen: 100 });
  let isAiLoading = $state(false);

  let importInput: HTMLInputElement;

  async function openLoadMenu() {
    projectList = await Api.projects.list();
    showLoadMenu = true;
  }

  async function triggerAi() {
    if (!waveformRef) return;
    isAiLoading = true;
    try {
      await waveformRef.askAiForChord(aiSettings);
    } finally {
      isAiLoading = false;
    }
  }

  function handleImportClick() {
    importInput.click();
  }
</script>

<main class="min-h-screen bg-gray-800 text-white p-8">
  <h1 class="text-3xl font-bold mb-6">Harmonist</h1>

  {#if !projectStore.current}
    <div class="flex gap-4">
      <button
        class="bg-blue-600 px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
        onclick={() => projectStore.create()}>New Project</button
      >

      <button
        class="bg-gray-600 px-6 py-3 rounded-lg hover:bg-gray-700 font-semibold"
        onclick={openLoadMenu}>Load Existing</button
      >

      <button
        class="border border-gray-500 px-6 py-3 rounded-lg hover:bg-gray-800 font-semibold text-gray-300"
        onclick={handleImportClick}
      >
        Import JSON
      </button>
      <input
        bind:this={importInput}
        type="file"
        accept=".json"
        class="hidden"
        onchange={(e) =>
          projectStore.importFile((e.target as HTMLInputElement).files![0])}
      />
    </div>

    {#if showLoadMenu}
      <div
        class="mt-8 bg-gray-900 p-6 rounded-lg max-w-md border border-gray-700"
      >
        <h2 class="text-xl mb-4 font-bold text-gray-300">Select Project</h2>
        {#if projectList.length === 0}
          <p class="text-gray-500">No projects found.</p>
        {:else}
          <ul class="space-y-2">
            {#each projectList as p}
              <li>
                <button
                  class="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded flex justify-between items-center"
                  onclick={() => {
                    projectStore.load(p.id);
                    showLoadMenu = false;
                  }}
                >
                  <span>{p.name}</span>
                  <span class="text-xs text-gray-500"
                    >{p.id.slice(0, 4)}...</span
                  >
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <button
          class="mt-4 text-sm text-gray-400 hover:text-white"
          onclick={() => (showLoadMenu = false)}>Cancel</button
        >
      </div>
    {/if}
  {:else}
    <div
      class="mb-6 flex gap-4 items-center bg-gray-900 p-4 rounded-lg border border-gray-700"
    >
      <div>
        <label class="text-xs text-gray-500 uppercase font-bold tracking-wider"
          >Project Name</label
        >
        <input
          type="text"
          bind:value={projectStore.current.name}
          class="block bg-transparent text-xl font-bold border-b border-gray-700 focus:border-blue-500 outline-none w-64"
        />
      </div>

      <div class="h-8 w-px bg-gray-700 mx-2"></div>

      <div class="flex flex-col">
        <label class="text-xs text-gray-500 uppercase font-bold tracking-wider"
          >Audio File</label
        >
        {#if projectStore.current.audio_file}
          <span class="text-sm text-green-400 truncate max-w-[200px]"
            >{projectStore.current.audio_file}</span
          >
        {:else}
          <input
            type="file"
            onchange={(e) =>
              projectStore.uploadAudio(
                (e.target as HTMLInputElement).files![0],
              )}
            class="text-sm text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
          />
        {/if}
      </div>

      <div class="flex-grow"></div>

      <button
        class="bg-indigo-900/50 text-indigo-200 px-4 py-2 rounded hover:bg-indigo-900 border border-indigo-900/50 mr-2"
        onclick={() => projectStore.download()}
      >
        Download JSON
      </button>

      <button
        class="bg-green-600 px-4 py-2 rounded hover:bg-green-700 shadow-lg"
        onclick={() => projectStore.save()}>Save Project</button
      >
      <button
        class="bg-red-900/50 text-red-200 px-4 py-2 rounded hover:bg-red-900"
        onclick={() => (projectStore.current = null)}>Close</button
      >
    </div>

    <div class="mb-4">
      <Waveform
        bind:this={waveformRef}
        audioUrl={projectStore.audioUrl || ""}
        regionsData={projectStore.current.regions}
        onRegionChange={(e) => projectStore.updateRegion(e)}
      />
    </div>

    <div
      class="flex gap-4 p-4 bg-gray-900 rounded-lg items-center border border-gray-700"
    >
      <button
        class="bg-gray-700 px-6 py-2 rounded hover:bg-gray-600 font-medium"
        onclick={() => waveformRef?.playPause()}>Play / Pause</button
      >

      <button
        class="bg-purple-600 px-6 py-2 rounded hover:bg-purple-700 font-medium"
        onclick={() => waveformRef?.addRegionAtCurrentTime("C")}
        >Add Chord</button
      >

      <button
        class="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 font-medium flex items-center gap-2 relative"
        onclick={triggerAi}
        title="Identify chord"
      >
        {#if isAiLoading}
          <div
            class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
          ></div>
        {:else}
          <span>✨ AI</span>
        {/if}
      </button>

      <button
        class="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 font-medium flex items-center gap-2 relative"
        onclick={() => (showAiSettings = !showAiSettings)}
        title="AI Settings">⚙️</button
      >

      {#if showAiSettings}
        <AiSettings
          settings={aiSettings}
          onClose={() => (showAiSettings = false)}
        />
      {/if}

      <div class="h-8 w-px bg-gray-700 mx-2"></div>

      <div class="flex flex-col">
        <span class="text-[10px] uppercase text-gray-500 font-bold"
          >Synth Vol</span
        >
        <input
          type="range"
          min="-40"
          max="20"
          value="-10"
          oninput={(e) =>
            waveformRef?.setSynthVolume(Number(e.currentTarget.value))}
          class="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer mt-2"
        />
      </div>

      <div class="flex flex-col">
        <span class="text-[10px] uppercase text-gray-500 font-bold">Sound</span>
        <select
          class="bg-gray-800 text-xs text-white p-1 rounded border border-gray-600 mt-1 outline-none focus:border-blue-500"
          onchange={(e) => waveformRef?.setOscillator(e.currentTarget.value)}
        >
          <option value="triangle">Triangle (Soft)</option>
          <option value="sine">Sine (Pure)</option>
          <option value="square">Square (Retro)</option>
          <option value="sawtooth">Sawtooth (Sharp)</option>
        </select>
      </div>
    </div>
  {/if}
</main>
