<script lang="ts">
  import { onDestroy } from "svelte";
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
  let saveNotice = $state("");

  let saveNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  let importInput = $state<HTMLInputElement | undefined>();

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
    importInput?.click();
  }

  function handleImportChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) projectStore.importFile(file);
  }

  function handleAudioChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) projectStore.uploadAudio(file);
  }

  function handleSaveProject() {
    projectStore.save();
    saveNotice = "Project saved locally";
    if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
    saveNoticeTimer = setTimeout(() => {
      saveNotice = "";
    }, 2200);
  }

  onDestroy(() => {
    if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
  });
</script>

<main class="app-shell">
  <header class="app-header">
    <p class="eyebrow">Local first chord workspace</p>
    <h1 class="app-title">Harmonist</h1>
    <p class="app-subtitle">
      Analyze recordings, review AI chord suggestions, and shape your timeline in
      a calm, consistent editing layout.
    </p>
  </header>

  {#if !projectStore.current}
    <section class="panel panel-muted stack">
      <div>
        <h2 class="panel-title">Start a Session</h2>
        <p class="panel-copy">
          Create a new chord project, resume previous work, or import a JSON
          timeline from disk.
        </p>
      </div>

      <div class="action-row">
        <button class="btn btn-primary" onclick={() => projectStore.create()}>
          New Project
        </button>
        <button class="btn btn-secondary" onclick={openLoadMenu}>
          Load Existing
        </button>
        <button class="btn btn-outline" onclick={handleImportClick}>
          Import JSON
        </button>
      </div>

      <input
        bind:this={importInput}
        type="file"
        accept=".json"
        class="hidden"
        onchange={handleImportChange}
      />
    </section>

    {#if showLoadMenu}
      <button
        type="button"
        class="modal-backdrop"
        onclick={() => (showLoadMenu = false)}
        aria-label="Close project picker"
      ></button>
      <div class="modal-card compact">
        <div class="modal-header">
          <h2 class="modal-title">Select Project</h2>
          <button class="close-ghost" onclick={() => (showLoadMenu = false)}>
            x
          </button>
        </div>

        {#if projectList.length === 0}
          <p class="panel-copy">No projects found yet.</p>
        {:else}
          <ul class="stack">
            {#each projectList as p}
              <li>
                <button
                  class="btn btn-outline w-full flex justify-between items-center"
                  onclick={() => {
                    projectStore.load(p.id);
                    showLoadMenu = false;
                  }}
                >
                  <span>{p.name}</span>
                  <span class="micro-label">{p.id.slice(0, 4)}...</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  {:else}
    <section class="panel stack">
      <div class="field-grid">
        <div class="field-group">
          <label class="micro-label" for="project-name">Project Name</label>
          <input
            id="project-name"
            type="text"
            bind:value={projectStore.current.name}
            class="input-field"
          />
        </div>

        <div class="field-group">
          <span class="micro-label">Audio File</span>
          {#if projectStore.current.audio_file}
            <span class="status-pill">{projectStore.current.audio_file}</span>
          {:else}
            <input
              type="file"
              onchange={handleAudioChange}
              class="file-input"
            />
          {/if}
        </div>

        <div class="action-row">
          <button class="btn btn-outline" onclick={() => projectStore.download()}>
            Download JSON
          </button>
          <button class="btn btn-success" onclick={handleSaveProject}>
            Save Project
          </button>
          <button
            class="btn btn-danger"
            onclick={() => (projectStore.current = null)}
          >
            Close
          </button>
        </div>
      </div>

      {#if saveNotice}
        <span class="status-pill muted">{saveNotice}</span>
      {/if}
    </section>

    <section class="panel stage-panel stack">
      <div class="split-header">
        <h2 class="panel-title">Timeline</h2>
        <p class="hint">Right click a region for edit actions</p>
      </div>
      <Waveform
        bind:this={waveformRef}
        audioUrl={projectStore.audioUrl || ""}
        regionsData={projectStore.current.regions}
        onRegionChange={(e) => projectStore.updateRegion(e)}
      />
    </section>

    <section class="panel panel-muted">
      <div class="control-grid">
        <div class="button-cluster">
          <button class="btn btn-secondary" onclick={() => waveformRef?.playPause()}>
            Play / Pause
          </button>

          <button
            class="btn btn-primary"
            onclick={() => waveformRef?.addRegionAtCurrentTime("C")}
          >
            Add Chord
          </button>

          <button class="btn btn-ai" onclick={triggerAi} title="Identify chord">
            {#if isAiLoading}
              <span class="flex items-center gap-2"><span class="spinner"></span>
                Analyzing</span
              >
            {:else}
              <span>AI Detect</span>
            {/if}
          </button>

          <button
            class="btn btn-outline btn-icon"
            onclick={() => (showAiSettings = !showAiSettings)}
            title="AI Settings"
          >
            AI Settings
          </button>
        </div>

        <div class="control-group">
          <span class="micro-label">Synth Volume</span>
          <input
            type="range"
            min="-40"
            max="20"
            value="-10"
            oninput={(e) =>
              waveformRef?.setSynthVolume(Number(e.currentTarget.value))}
            class="range-control"
          />
        </div>

        <div class="control-group">
          <span class="micro-label">Synth Shape</span>
          <select
            class="select-control"
            onchange={(e) => waveformRef?.setOscillator(e.currentTarget.value)}
          >
            <option value="triangle">Triangle (soft)</option>
            <option value="sine">Sine (pure)</option>
            <option value="square">Square (retro)</option>
            <option value="sawtooth">Sawtooth (sharp)</option>
          </select>
        </div>
      </div>

      {#if showAiSettings}
        <AiSettings
          settings={aiSettings}
          onClose={() => (showAiSettings = false)}
        />
      {/if}
    </section>
  {/if}
</main>
