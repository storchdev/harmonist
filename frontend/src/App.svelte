<script lang="ts">
  import axios from "axios";
  import Waveform from "./components/Waveform.svelte";
  import type { ProjectData, RegionChangeEvent } from "./types";

  // --- State ---
  let currentProject = $state<ProjectData | null>(null);
  let audioUrl = $state<string | null>(null);
  let waveformComponent = $state<Waveform | undefined>(undefined);

  let showAiSettings = $state(false);
  let aiSettings = $state({
    onset: 0.6, // Sensitivity (Higher = less ghost notes)
    frame: 0.4, // Sustain (Higher = less muddy)
    minNoteLen: 100, // ms (Higher = ignore fast blips)
  });

  // New state for the load menu
  let projectList = $state<{ id: string; name: string }[]>([]);
  let showLoadMenu = $state(false);

  let isAiLoading = $state(false);

  // --- Actions ---

  async function handleAiClick() {
    if (!waveformComponent) return;

    isAiLoading = true;
    try {
      // We await the child's function
      await waveformComponent.askAiForChord();
    } finally {
      isAiLoading = false;
    }
  }

  async function createProject() {
    const res = await axios.post("/api/projects", { name: "New Analysis" });
    loadProjectIntoState(res.data);
  }

  async function fetchAndShowProjects() {
    const res = await axios.get("/api/projects");
    projectList = res.data;
    showLoadMenu = true;
  }

  async function loadExistingProject(id: string) {
    const res = await axios.get(`/api/projects/${id}`);
    loadProjectIntoState(res.data);
    showLoadMenu = false;
  }

  // Helper to centralize loading logic
  function loadProjectIntoState(data: ProjectData) {
    currentProject = data;
    // Important: If the project has an audio file saved, construct the URL
    if (data.audio_file) {
      audioUrl = `/api/audio/${data.audio_file}`;
    } else {
      audioUrl = null;
    }
  }

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length || !currentProject) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post("/api/upload", formData);
    const filename = res.data.filename;

    // Update state
    currentProject.audio_file = filename;
    audioUrl = `/api/audio/${filename}`;

    // Auto-save the project reference immediately
    handleSave();
  }

  // Update the type signature if not using 'any'
  function handleRegionChange(data: any) {
    // using 'any' for brevity, or union type
    if (!currentProject) return;

    // Handle Deletion
    if (data.action === "delete") {
      currentProject.regions = currentProject.regions.filter(
        (r) => r.id !== data.id,
      );
      console.log("Deleted region", data.id);
      return;
    }

    // Handle Update/Add
    const idx = currentProject.regions.findIndex((r) => r.id === data.id);

    if (idx >= 0) {
      // Update
      currentProject.regions[idx] = {
        ...currentProject.regions[idx],
        start: data.start,
        end: data.end,
        chord_symbol: data.content,
        octave: data.octave || 4,
      };
    } else {
      // Add
      currentProject.regions.push({
        id: data.id,
        start: data.start,
        end: data.end,
        chord_symbol: data.content,
        octave: data.octave || 4,
      });
    }

    // Sort regions by time just to be clean
    currentProject.regions.sort((a, b) => a.start - b.start);
  }

  function handleSave() {
    if (!currentProject) return;
    axios.put(`/api/projects/${currentProject.id}`, currentProject);
    console.log("Saved project");
  }

  function handleAddChord() {
    waveformComponent?.addRegionAtCurrentTime("C");
  }

  function toggleSettings(e: MouseEvent) {
    e.stopPropagation(); // Prevent the window click from firing immediately
    showAiSettings = !showAiSettings;
  }

  function closeSettings() {
    showAiSettings = false;
  }
</script>

<main class="min-h-screen bg-gray-800 text-white p-8">
  <h1 class="text-3xl font-bold mb-6">Chord Analyzer</h1>

  {#if !currentProject}
    <div class="flex gap-4">
      <button
        class="bg-blue-600 px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
        onclick={createProject}
      >
        New Project
      </button>

      <button
        class="bg-gray-600 px-6 py-3 rounded-lg hover:bg-gray-700 font-semibold"
        onclick={fetchAndShowProjects}
      >
        Load Existing
      </button>
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
                  onclick={() => loadExistingProject(p.id)}
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
          bind:value={currentProject.name}
          class="block bg-transparent text-xl font-bold border-b border-gray-700 focus:border-blue-500 outline-none w-64"
        />
      </div>

      <div class="h-8 w-px bg-gray-700 mx-2"></div>

      <div class="flex flex-col">
        <label class="text-xs text-gray-500 uppercase font-bold tracking-wider"
          >Audio File</label
        >
        {#if currentProject.audio_file}
          <span class="text-sm text-green-400 truncate max-w-[200px]"
            >{currentProject.audio_file}</span
          >
        {:else}
          <input
            type="file"
            onchange={handleFileUpload}
            class="text-sm text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
          />
        {/if}
      </div>

      <div class="flex-grow"></div>

      <button
        class="bg-green-600 px-4 py-2 rounded hover:bg-green-700 shadow-lg"
        onclick={handleSave}
      >
        Save Project
      </button>
      <button
        class="bg-red-900/50 text-red-200 px-4 py-2 rounded hover:bg-red-900"
        onclick={() => (currentProject = null)}
      >
        Close
      </button>
    </div>

    <div class="mb-4">
      <Waveform
        bind:this={waveformComponent}
        audioUrl={audioUrl || ""}
        regionsData={currentProject.regions}
        onRegionChange={handleRegionChange}
      />
    </div>

    <div
      class="flex gap-4 p-4 bg-gray-900 rounded-lg items-center border border-gray-700"
    >
      <button
        class="bg-gray-700 px-6 py-2 rounded hover:bg-gray-600 font-medium"
        onclick={() => waveformComponent?.playPause()}
      >
        Play / Pause
      </button>
      <button
        class="bg-purple-600 px-6 py-2 rounded hover:bg-purple-700 font-medium"
        onclick={handleAddChord}
      >
        Add Chord
      </button>

      <button
        class="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 font-medium flex items-center gap-2 relative"
        onclick={handleAiClick}
        title="Identify chord at current time"
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
        title="AI Settings"
      >
        AI Settings
      </button>

      {#if showAiSettings}
        <div
          class="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm"
          onclick={closeSettings}
        ></div>

        <div
          class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-5 z-[101]"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="flex justify-between items-center mb-4">
            <h4 class="text-sm font-bold text-white uppercase tracking-wider">
              AI Sensitivity
            </h4>
            <button
              class="text-gray-400 hover:text-white"
              onclick={closeSettings}>✕</button
            >
          </div>

          <div class="mb-4">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-300">Detection Thresh</span>
              <span class="text-indigo-300 font-mono">{aiSettings.onset}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              bind:value={aiSettings.onset}
              class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p class="text-[10px] text-gray-500 mt-1">
              Higher = Fewer, clearer notes
            </p>
          </div>

          <div class="mb-4">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-300">Sustain Thresh</span>
              <span class="text-indigo-300 font-mono">{aiSettings.frame}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              bind:value={aiSettings.frame}
              class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p class="text-[10px] text-gray-500 mt-1">
              Higher = Shorter sustain
            </p>
          </div>

          <div class="mb-4">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-300">Min Note (ms)</span>
              <span class="text-indigo-300 font-mono"
                >{aiSettings.minNoteLen}</span
              >
            </div>
            <input
              type="range"
              min="30"
              max="300"
              step="10"
              bind:value={aiSettings.minNoteLen}
              class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div class="pt-2 border-t border-gray-700 flex justify-end">
            <button
              class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded"
              onclick={closeSettings}>Done</button
            >
          </div>
        </div>
      {/if}

      <div class="h-8 w-px bg-gray-700 mx-2"></div>

      <div class="flex flex-col">
        <span class="text-[10px] uppercase text-gray-500 font-bold"
          >Synth Vol</span
        >
        <input
          type="range"
          min="-40"
          max="0"
          value="-10"
          oninput={(e) =>
            waveformComponent?.setSynthVolume(Number(e.currentTarget.value))}
          class="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer mt-2"
        />
      </div>

      <div class="flex flex-col">
        <span class="text-[10px] uppercase text-gray-500 font-bold">Sound</span>
        <select
          class="bg-gray-800 text-xs text-white p-1 rounded border border-gray-600 mt-1 outline-none focus:border-blue-500"
          onchange={(e) =>
            waveformComponent?.setOscillator(e.currentTarget.value)}
        >
          <option value="triangle">Triangle (Soft)</option>
          <option value="sine">Sine (Pure)</option>
          <option value="square">Square (Retro)</option>
          <option value="sawtooth">Sawtooth (Sharp)</option>
        </select>
      </div>
    </div>
    <!-- <div class="flex items-center gap-2 mt-4">
      <span class="text-xs text-gray-400">Synth Vol</span>
      <input
        type="range"
        min="-40"
        max="0"
        value="-10"
        oninput={(e) =>
          waveformComponent?.setSynthVolume(Number(e.currentTarget.value))}
        class="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
      />
    </div> -->
  {/if}
</main>
