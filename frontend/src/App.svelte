<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { projectStore } from "./lib/projectStore.svelte";
  import { Api } from "./lib/api";
  import Waveform from "./components/Waveform.svelte";
  import AiSettings from "./components/AiSettings.svelte";
  import ShortcutsHelp from "./components/ShortcutsHelp.svelte";
  import * as catppuccin from "@catppuccin/palette";
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
    Check,
    Keyboard,
    Undo2,
    Palette,
  } from "@lucide/svelte";

  const oscillatorLabels: Record<string, string> = {
    triangle: "Triangle (soft)",
    sine: "Sine (pure)",
    square: "Square (retro)",
    sawtooth: "Sawtooth (sharp)",
  };

  let showLoadMenu = $state(false);
  let projectList = $state<{ id: string; name: string }[]>([]);
  let showAiSettings = $state(false);
  let showSynthMenu = $state(false);
  let oscillator = $state("triangle");
  let showShortcuts = $state(false);
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
    applyPalette();
  }

  // --- Color themes ---
  // Catppuccin's flavors come straight from the official @catppuccin/palette
  // package; Tokyo Night and Rosé Pine don't have a maintained raw-palette
  // package (only editor-theme bundles), so their canonical published hex
  // values are used directly instead.
  type RawPalette = {
    bg: string;
    bgElevated: string;
    bgInset: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    textFaint: string;
    accent: string;
    secondary: string;
    amber: string;
    success: string;
    danger: string;
  };

  const mocha = catppuccin.flavors.mocha.colors;
  const latte = catppuccin.flavors.latte.colors;

  const themeFamilies: { id: string; label: string; light: RawPalette; dark: RawPalette }[] = [
    {
      id: "default",
      label: "Default",
      light: {
        bg: "#f7f7f8",
        bgElevated: "#ffffff",
        bgInset: "#f0f0f2",
        border: "#e4e4e8",
        borderStrong: "#d4d4da",
        text: "#17171a",
        textMuted: "#6b6b76",
        textFaint: "#9a9aa4",
        accent: "#4f46e5",
        secondary: "#0891b2",
        amber: "#d97706",
        success: "#16a34a",
        danger: "#dc2626",
      },
      dark: {
        bg: "#0d0d10",
        bgElevated: "#17171b",
        bgInset: "#1e1e23",
        border: "#26262c",
        borderStrong: "#34343c",
        text: "#f2f2f4",
        textMuted: "#9a9aa4",
        textFaint: "#6b6b76",
        accent: "#6366f1",
        secondary: "#22d3ee",
        amber: "#f59e0b",
        success: "#22c55e",
        danger: "#ef4444",
      },
    },
    {
      id: "tokyo-night",
      label: "Tokyo Night",
      light: {
        bg: "#e1e2e7",
        bgElevated: "#ffffff",
        bgInset: "#dfe0e5",
        border: "#c4c8da",
        borderStrong: "#a8afc7",
        text: "#343b58",
        textMuted: "#565a6e",
        textFaint: "#9699a3",
        accent: "#2e7de9",
        secondary: "#9854f1",
        amber: "#8f5e15",
        success: "#385f0d",
        danger: "#8c4351",
      },
      dark: {
        bg: "#1a1b26",
        bgElevated: "#1f2335",
        bgInset: "#24283b",
        border: "#292e42",
        borderStrong: "#3b4261",
        text: "#c0caf5",
        textMuted: "#9aa5ce",
        textFaint: "#565f89",
        accent: "#7aa2f7",
        secondary: "#bb9af7",
        amber: "#e0af68",
        success: "#9ece6a",
        danger: "#f7768e",
      },
    },
    {
      id: "catppuccin",
      label: "Catppuccin",
      light: {
        bg: latte.mantle.hex,
        bgElevated: latte.base.hex,
        bgInset: latte.crust.hex,
        border: latte.surface0.hex,
        borderStrong: latte.surface1.hex,
        text: latte.text.hex,
        textMuted: latte.subtext0.hex,
        textFaint: latte.overlay1.hex,
        accent: latte.mauve.hex,
        secondary: latte.blue.hex,
        amber: latte.yellow.hex,
        success: latte.green.hex,
        danger: latte.red.hex,
      },
      dark: {
        bg: mocha.mantle.hex,
        bgElevated: mocha.base.hex,
        bgInset: mocha.surface0.hex,
        border: mocha.surface1.hex,
        borderStrong: mocha.surface2.hex,
        text: mocha.text.hex,
        textMuted: mocha.subtext0.hex,
        textFaint: mocha.overlay1.hex,
        accent: mocha.mauve.hex,
        secondary: mocha.blue.hex,
        amber: mocha.yellow.hex,
        success: mocha.green.hex,
        danger: mocha.red.hex,
      },
    },
    {
      id: "rose-pine",
      label: "Rosé Pine",
      light: {
        bg: "#faf4ed",
        bgElevated: "#fffaf3",
        bgInset: "#f2e9e1",
        border: "#dfdad9",
        borderStrong: "#cecacd",
        text: "#575279",
        textMuted: "#797593",
        textFaint: "#9893a5",
        accent: "#907aa9",
        secondary: "#56949f",
        amber: "#ea9d34",
        success: "#286983",
        danger: "#b4637a",
      },
      dark: {
        bg: "#191724",
        bgElevated: "#1f1d2e",
        bgInset: "#26233a",
        border: "#403d52",
        borderStrong: "#524f67",
        text: "#e0def4",
        textMuted: "#908caa",
        textFaint: "#6e6a86",
        accent: "#c4a7e7",
        secondary: "#9ccfd8",
        amber: "#f6c177",
        success: "#31748f",
        danger: "#eb6f92",
      },
    },
  ];

  let themeFamily = $state(localStorage.getItem("themeFamily") || "default");
  let showAccentMenu = $state(false);

  function hexToRgb(hex: string) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function shade(hex: string, percent: number) {
    const { r, g, b } = hexToRgb(hex);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    const mix = (c: number) => Math.round((t - c) * p) + c;
    return `#${[mix(r), mix(g), mix(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }

  function withAlpha(hex: string, alpha: number) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function activeFamily() {
    return themeFamilies.find((f) => f.id === themeFamily) ?? themeFamilies[0];
  }

  function applyPalette() {
    const raw = activeFamily()[theme];
    const strongDir = theme === "dark" ? 0.18 : -0.15;
    const softAlpha = theme === "dark" ? 0.16 : 0.1;

    const root = document.documentElement.style;
    root.setProperty("--bg", raw.bg);
    root.setProperty("--bg-elevated", raw.bgElevated);
    root.setProperty("--bg-inset", raw.bgInset);
    root.setProperty("--border", raw.border);
    root.setProperty("--border-strong", raw.borderStrong);
    root.setProperty("--text", raw.text);
    root.setProperty("--text-muted", raw.textMuted);
    root.setProperty("--text-faint", raw.textFaint);
    root.setProperty("--accent", raw.accent);
    root.setProperty("--accent-strong", shade(raw.accent, strongDir));
    root.setProperty("--accent-soft", withAlpha(raw.accent, softAlpha));
    root.setProperty("--secondary", raw.secondary);
    root.setProperty("--secondary-strong", shade(raw.secondary, strongDir));
    root.setProperty("--secondary-soft", withAlpha(raw.secondary, softAlpha));
    root.setProperty("--amber", raw.amber);
    root.setProperty("--amber-soft", withAlpha(raw.amber, softAlpha));
    root.setProperty("--success", raw.success);
    root.setProperty("--success-soft", withAlpha(raw.success, softAlpha));
    root.setProperty("--danger", raw.danger);
    root.setProperty("--danger-soft", withAlpha(raw.danger, softAlpha));
    root.setProperty("--focus-ring", withAlpha(raw.accent, theme === "dark" ? 0.4 : 0.35));
    root.setProperty(
      "--wave-color",
      shade(raw.accent, theme === "dark" ? -0.45 : 0.5),
    );
    root.setProperty("--wave-progress-color", raw.accent);

    waveformRef?.refreshThemeColors();
  }

  function selectThemeFamily(id: string) {
    themeFamily = id;
    localStorage.setItem("themeFamily", id);
    applyPalette();
    showAccentMenu = false;
  }

  async function toggleLoadMenu() {
    if (showLoadMenu) {
      showLoadMenu = false;
      return;
    }
    projectList = await Api.projects.list();
    showLoadMenu = true;
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      projectStore.undo();
    }
  }

  function handleWindowClick(e: MouseEvent) {
    if (showLoadMenu && !(e.target as HTMLElement).closest(".dropdown")) {
      showLoadMenu = false;
    }
    if (showSynthMenu && !(e.target as HTMLElement).closest(".synth-dropdown")) {
      showSynthMenu = false;
    }
    if (showAccentMenu && !(e.target as HTMLElement).closest(".accent-dropdown")) {
      showAccentMenu = false;
    }
  }

  function toggleSynthMenu() {
    showSynthMenu = !showSynthMenu;
  }

  function selectOscillator(value: string) {
    oscillator = value;
    showSynthMenu = false;
    waveformRef?.setOscillator(value);
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
    applyPalette();
    projectStore.restoreLastProject();
  });
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<main class="app-shell">
  <header class="app-header">
    <div class="brand">
      <span class="brand-icon"><Music size={17} /></span>
      <h1 class="app-title">Harmonist</h1>
    </div>
    <div class="header-actions">
      <button
        class="theme-toggle"
        onclick={() => (showShortcuts = true)}
        title="Keyboard shortcuts"
      >
        <Keyboard size={16} />
      </button>
      <div class="dropdown accent-dropdown">
        <button
          class="theme-toggle"
          onclick={() => (showAccentMenu = !showAccentMenu)}
          title="Theme"
        >
          <Palette size={16} />
        </button>
        {#if showAccentMenu}
          <div class="dropdown-menu accent-menu">
            {#each themeFamilies as family}
              <button
                class="dropdown-item"
                class:active={themeFamily === family.id}
                onclick={() => selectThemeFamily(family.id)}
              >
                <span class="accent-swatch-row">
                  <span
                    class="accent-swatch"
                    style="background:{family[theme].accent}"
                  ></span>
                  {family.label}
                </span>
                {#if themeFamily === family.id}<Check size={14} />{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <button class="theme-toggle" onclick={toggleTheme} title="Toggle theme">
        {#if theme === "dark"}
          <Sun size={16} />
        {:else}
          <Moon size={16} />
        {/if}
      </button>
    </div>
  </header>

  {#if showShortcuts}
    <ShortcutsHelp onClose={() => (showShortcuts = false)} />
  {/if}

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
    <section class="panel project-bar">
      <input
        type="text"
        bind:value={projectStore.current.name}
        class="project-name-input"
        placeholder="Untitled project"
      />

      {#if projectStore.current.audio_file}
        <span class="audio-pill" title={projectStore.current.audio_file}>
          <Music size={13} />
          <span class="audio-pill-text">{projectStore.current.audio_file}</span>
        </span>
      {:else}
        <input type="file" onchange={handleAudioChange} class="file-input" />
      {/if}

      {#if saveNotice}
        <span class="status-pill muted">{saveNotice}</span>
      {/if}

      <div class="toolbar-group project-actions">
        <button
          class="btn-ghost"
          onclick={() => projectStore.undo()}
          disabled={!projectStore.canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          class="btn-ghost"
          onclick={() => projectStore.download()}
          title="Download JSON"
        >
          <Download size={16} />
        </button>
        <button class="btn-ghost" onclick={handleSaveProject} title="Save project">
          <Save size={16} />
        </button>
        <button
          class="btn-ghost btn-ghost-danger"
          onclick={() => projectStore.close()}
          title="Close project"
        >
          <X size={16} />
        </button>
      </div>
    </section>

    <section class="panel stage-panel">
      <Waveform
        bind:this={waveformRef}
        audioUrl={projectStore.audioUrl || ""}
        regionsData={projectStore.current.regions}
        onRegionChange={(e) => projectStore.updateRegion(e)}
      />
    </section>

    <section class="panel panel-muted toolbar">
      <div class="toolbar-group">
        <button
          class="btn btn-play btn-icon"
          onclick={() => waveformRef?.playPause()}
          title="Play / pause"
        >
          <Play size={16} />
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
          class="btn-ghost"
          onclick={() => (showAiSettings = !showAiSettings)}
          title="AI detection settings"
        >
          <Settings2 size={16} />
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <div class="volume-control volume-synth">
          <button class="btn-ghost" onclick={toggleSynthMute} title="Mute synth">
            {#if synthMuted}<VolumeX size={16} />{:else}<Volume2 size={16} />{/if}
          </button>
          <span class="volume-tag">Synth</span>
          <input
            type="range"
            min="-40"
            max="20"
            bind:value={synthVolume}
            oninput={() => waveformRef?.setSynthVolume(synthVolume)}
            class="range-control range-compact"
          />
        </div>

        <div class="volume-control volume-track">
          <button class="btn-ghost" onclick={toggleTrackMute} title="Mute track">
            {#if trackMuted}<VolumeX size={16} />{:else}<Volume2 size={16} />{/if}
          </button>
          <span class="volume-tag">Track</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            bind:value={trackVolume}
            oninput={() => waveformRef?.setTrackVolume(trackVolume)}
            class="range-control range-compact"
          />
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <div class="dropdown synth-dropdown">
        <button class="btn btn-outline synth-dropdown-btn" onclick={toggleSynthMenu}>
          {oscillatorLabels[oscillator]}
          <ChevronDown size={14} />
        </button>
        {#if showSynthMenu}
          <div class="dropdown-menu synth-dropdown-menu">
            {#each Object.entries(oscillatorLabels) as [value, label]}
              <button
                class="dropdown-item"
                class:active={oscillator === value}
                onclick={() => selectOscillator(value)}
              >
                <span>{label}</span>
                {#if oscillator === value}<Check size={14} />{/if}
              </button>
            {/each}
          </div>
        {/if}
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
