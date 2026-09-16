<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { projectStore } from "./lib/projectStore.svelte";
  import { Api } from "./lib/api";
  import Waveform from "./components/Waveform.svelte";
  import AiSettings from "./components/AiSettings.svelte";
  import {
    Music,
    FolderOpen,
    FilePlus,
    Upload,
    Download,
    Save,
    X,
    Play,
    Plus,
    Sparkles,
    Settings2,
    Volume2,
    VolumeX,
    Sun,
    Moon,
    ChevronDown,
  } from "@lucide/svelte";

  let showLoadMenu = $state(false);
  let projectList = $state<{ id: string; name: string }[]>([]);
  let showAiSettings = $state(false);
  let waveformRef = $state<Waveform>();
  let synthVolume = $state(-10);
  let trackVolume = $state(1);
  let synthMuted = $state(false);
  let trackMuted = $state(false);

  let aiSettings = $state({ onset: 0.6, frame: 0.4, minNoteLen: 100 });
  let isAiLoading = $state(false);
  let saveNotice = $state("");

  let saveNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  let importInput = $state<HTMLInputElement | undefined>();

  let theme = $state<"light" | "dark">(
    (localStorage.getItem("theme") as "light" | "dark") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"),
  );

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();
  }

  async function toggleLoadMenu() {
    if (showLoadMenu) {
      showLoadMenu = false;
      return;
    }
    projectList = await Api.projects.list();
    showLoadMenu = true;
  }

  function handleWindowClick(e: MouseEvent) {
    if (showLoadMenu && !(e.target as HTMLElement).closest(".dropdown")) {
      showLoadMenu = false;
    }
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

  function toggleSynthMute() {
    synthMuted = !synthMuted;
    waveformRef?.setSynthMuted(synthMuted);
  }

  function toggleTrackMute() {
    trackMuted = !trackMuted;
    waveformRef?.setTrackMuted(trackMuted);
  }

  async function handleSaveProject() {
    try {
      await projectStore.save();
      saveNotice = "Project saved";
    } catch (error) {
      console.error("Failed to save project", error);
      saveNotice = "Could not save project";
    }
    if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
    saveNoticeTimer = setTimeout(() => {
      saveNotice = "";
    }, 2200);
  }

  onDestroy(() => {
    if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
  });

  onMount(() => {
    applyTheme();
    projectStore.restoreLastProject();
  });
</script>

<svelte:window onclick={handleWindowClick} />

<main class="app-shell">
  <header class="app-header">
    <div class="brand">
      <span class="brand-icon"><Music size={17} /></span>
      <h1 class="app-title">Harmonist</h1>
    </div>
    <button class="theme-toggle" onclick={toggleTheme} title="Toggle theme">
      {#if theme === "dark"}
        <Sun size={16} />
      {:else}
        <Moon size={16} />
      {/if}
    </button>
  </header>

  {#if !projectStore.current}
    <section class="panel">
      <div class="empty-state">
        <span class="empty-icon"><Music size={26} /></span>
        <div class="action-row">
          <button class="btn btn-primary" onclick={() => projectStore.create()}>
            <FilePlus size={16} /> New Project
          </button>
          <div class="dropdown">
            <button class="btn btn-secondary" onclick={toggleLoadMenu}>
              <FolderOpen size={16} /> Load Existing
              <ChevronDown size={14} />
            </button>
            {#if showLoadMenu}
              <div class="dropdown-menu">
                {#if projectList.length === 0}
                  <p class="dropdown-empty">No projects found yet.</p>
                {:else}
                  {#each projectList as p}
                    <button
                      class="dropdown-item"
                      onclick={() => {
                        projectStore.load(p.id);
                        showLoadMenu = false;
                      }}
                    >
                      <span class="dropdown-item-name">{p.name}</span>
                      <span class="dropdown-item-id">{p.id.slice(0, 4)}</span>
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>
          <button class="btn btn-outline" onclick={handleImportClick}>
            <Upload size={16} /> Import JSON
          </button>
        </div>
      </div>

      <input
        bind:this={importInput}
        type="file"
        accept=".json"
        class="hidden"
        onchange={handleImportChange}
      />
    </section>
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
            <span class="status-pill audio-file-pill"
              >{projectStore.current.audio_file}</span
            >
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
            <Download size={16} /> JSON
          </button>
          <button class="btn btn-success" onclick={handleSaveProject}>
            <Save size={16} /> Save
          </button>
          <button
            class="btn btn-danger"
            onclick={() => projectStore.close()}
          >
            <X size={16} /> Close
          </button>
        </div>
      </div>

      {#if saveNotice}
        <span class="status-pill muted">{saveNotice}</span>
      {/if}
    </section>

    <section class="panel stage-panel">
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
            <Play size={16} /> Play / Pause
          </button>

          <button
            class="btn btn-primary"
            onclick={() => waveformRef?.addRegionAtCurrentTime("C")}
          >
            <Plus size={16} /> Add Chord
          </button>

          <button class="btn btn-ai" onclick={triggerAi} title="Identify chord">
            {#if isAiLoading}
              <span class="spinner"></span> Analyzing
            {:else}
              <Sparkles size={16} /> AI Detect
            {/if}
          </button>

          <button
            class="btn btn-outline btn-icon"
            onclick={() => (showAiSettings = !showAiSettings)}
            title="AI Settings"
          >
            <Settings2 size={16} />
          </button>
        </div>

        <div class="control-group">
          <span class="micro-label">Synth Volume</span>
          <div class="control-row">
            <input
              type="range"
              min="-40"
              max="20"
              bind:value={synthVolume}
              oninput={() => waveformRef?.setSynthVolume(synthVolume)}
              class="range-control"
            />
            <button class="btn-ghost" onclick={toggleSynthMute} title="Mute synth">
              {#if synthMuted}<VolumeX size={16} />{:else}<Volume2 size={16} />{/if}
            </button>
          </div>
        </div>

        <div class="control-group">
          <span class="micro-label">Track Volume</span>
          <div class="control-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              bind:value={trackVolume}
              oninput={() => waveformRef?.setTrackVolume(trackVolume)}
              class="range-control"
            />
            <button class="btn-ghost" onclick={toggleTrackMute} title="Mute track">
              {#if trackMuted}<VolumeX size={16} />{:else}<Volume2 size={16} />{/if}
            </button>
          </div>
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
