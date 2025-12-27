<script lang="ts">
  import axios from "axios";
  import Waveform from "./components/Waveform.svelte";
  import type { ProjectData, RegionChangeEvent } from "./types";

  // --- State ---
  let currentProject = $state<ProjectData | null>(null);
  let audioUrl = $state<string | null>(null);
  let waveformComponent = $state<Waveform | undefined>(undefined);

  // New state for the load menu
  let projectList = $state<{ id: string; name: string }[]>([]);
  let showLoadMenu = $state(false);

  // --- Actions ---

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
        (r) => r.id !== data.id
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
      };
    } else {
      // Add
      currentProject.regions.push({
        id: data.id,
        start: data.start,
        end: data.end,
        chord_symbol: data.content,
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
      class="flex gap-4 p-4 bg-gray-900 rounded-lg justify-center border border-gray-700"
    >
      <button
        class="bg-gray-700 px-6 py-2 rounded hover:bg-gray-600 font-medium"
        onclick={() => waveformComponent?.playPause()}
      >
        Play / Pause (Space)
      </button>
      <button
        class="bg-purple-600 px-6 py-2 rounded hover:bg-purple-700 font-medium"
        onclick={handleAddChord}
      >
        Add Chord (M)
      </button>
    </div>
    <div class="flex items-center gap-2 mt-4">
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
    </div>
  {/if}
</main>
