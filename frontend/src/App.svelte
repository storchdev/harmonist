<script lang="ts">
  import { onMount } from "svelte";
  import { projectStore } from "./lib/projectStore.svelte";
  import { Api } from "./lib/api";
  import Waveform from "./components/Waveform.svelte";
  import AiSettings from "./components/AiSettings.svelte";
  import ShortcutsHelp from "./components/ShortcutsHelp.svelte";
  import LoadProjectModal from "./components/LoadProjectModal.svelte";
  import type { EditorSettings } from "./types";
  import {
    bundledThemes,
    bundledThemesInfo,
    type BundledTheme,
  } from "shiki/themes";
  import {
    Music,
    FolderOpen,
    FilePlus,
    Upload,
    Download,
    Save,
    Home,
    Play,
    Pause,
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
    StickyNote,
    Search,
  } from "@lucide/svelte";

  const oscillatorLabels: Record<string, string> = {
    triangle: "Triangle (soft)",
    sine: "Sine (pure)",
    square: "Square (retro)",
    sawtooth: "Sawtooth (sharp)",
  };

  let showLoadModal = $state(false);
  let showAiSettings = $state(false);
  let showSynthMenu = $state(false);
  let oscillator = $state("triangle");
  let showShortcuts = $state(false);
  let waveformRef = $state<Waveform>();
  let synthVolume = $state(-10);
  let trackVolume = $state(1);
  let synthMuted = $state(false);
  let trackMuted = $state(false);
  let defaultChordLength = $state(2.0);

  let aiSettings = $state({ onset: 0.6, frame: 0.4, minNoteLen: 100 });
  let isAiLoading = $state(false);
  let syncedProjectId = $state<string | null>(null);

  function updateSettings(
    partial: Partial<EditorSettings>,
    opts: { silent?: boolean } = {},
  ) {
    if (!projectStore.current?.settings) return;
    Object.assign(projectStore.current.settings, partial);
    if (!opts.silent) projectStore.dirty = true;
  }

  function syncSettingsFromProject() {
    const s = projectStore.current?.settings;
    if (!s) return;
    oscillator = s.oscillator;
    synthVolume = s.synthVolume;
    trackVolume = s.trackVolume;
    synthMuted = s.synthMuted;
    trackMuted = s.trackMuted;
    defaultChordLength = s.defaultChordLength;
    aiSettings = { ...s.aiSettings };
  }

  function applySettingsToController() {
    waveformRef?.setOscillator(oscillator);
    waveformRef?.setSynthVolume(synthVolume);
    waveformRef?.setTrackVolume(trackVolume);
    waveformRef?.setSynthMuted(synthMuted);
    waveformRef?.setTrackMuted(trackMuted);
    waveformRef?.setDefaultChordLength(defaultChordLength);
  }

  function updateDefaultChordLength() {
    waveformRef?.setDefaultChordLength(defaultChordLength);
    updateSettings({ defaultChordLength }, { silent: true });
  }

  $effect(() => {
    const id = projectStore.current?.id;
    if (id && id !== syncedProjectId) {
      syncedProjectId = id;
      syncSettingsFromProject();
    }
  });

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
    void applyPalette();
  }

  // --- Color themes ---
  // Uses shiki's bundled theme collection (65 real editor themes - Tokyo
  // Night, Catppuccin, Rosé Pine, Dracula, Nord, etc.) as the palette source.
  // Themes are stratified by shiki's own light/dark classification, so
  // switching light/dark mode picks from a separate saved theme per mode.
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

  const themeInfoById = new Map(
    bundledThemesInfo.map((t) => [t.id as BundledTheme, t]),
  );
  const lightThemes = bundledThemesInfo.filter((t) => t.type === "light");
  const darkThemes = bundledThemesInfo.filter((t) => t.type === "dark");

  const DEFAULT_LIGHT_THEME: BundledTheme = "github-light";
  const DEFAULT_DARK_THEME: BundledTheme = "tokyo-night";

  let lightThemeId = $state<BundledTheme>(
    (localStorage.getItem("lightThemeId") as BundledTheme) ||
      DEFAULT_LIGHT_THEME,
  );
  let darkThemeId = $state<BundledTheme>(
    (localStorage.getItem("darkThemeId") as BundledTheme) || DEFAULT_DARK_THEME,
  );
  let showAccentMenu = $state(false);
  let themeSearch = $state("");

  function activeThemeId(): BundledTheme {
    return theme === "dark" ? darkThemeId : lightThemeId;
  }

  function hexToRgb(hex: string) {
    const h = hex.replace("#", "").slice(0, 6);
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
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

  function findTokenColor(
    tokenColors: any[] | undefined,
    targets: string[],
    fallback: string,
  ): string {
    const rules = tokenColors ?? [];
    for (let i = rules.length - 1; i >= 0; i -= 1) {
      const rule = rules[i];
      const scopes: string[] = Array.isArray(rule.scope)
        ? rule.scope
        : rule.scope
          ? [rule.scope]
          : [];
      if (!scopes.length || !rule.settings?.foreground) continue;
      if (
        scopes.some((scope) =>
          targets.some(
            (target) => scope === target || scope.startsWith(`${target}.`),
          ),
        )
      ) {
        return rule.settings.foreground;
      }
    }
    return fallback;
  }

  function extractPalette(shikiTheme: any, mode: "light" | "dark"): RawPalette {
    const colors = shikiTheme.colors ?? {};
    const tokenColors = shikiTheme.tokenColors;

    const bg =
      colors["editor.background"] || (mode === "dark" ? "#0d0d10" : "#f7f7f8");
    const text =
      colors["editor.foreground"] || (mode === "dark" ? "#f2f2f4" : "#17171a");
    const surface =
      colors["sideBar.background"] ||
      colors["panel.background"] ||
      colors["editorWidget.background"] ||
      shade(bg, mode === "dark" ? 0.06 : -0.03);
    const inset =
      colors["editorWidget.background"] ||
      colors["terminal.background"] ||
      shade(bg, mode === "dark" ? -0.03 : -0.02);
    const border =
      colors["panel.border"] ||
      colors["editorWidget.border"] ||
      colors["contrastBorder"] ||
      shade(bg, mode === "dark" ? 0.12 : -0.1);
    const accent =
      colors["button.background"] ||
      colors["focusBorder"]?.slice(0, 7) ||
      findTokenColor(
        tokenColors,
        ["entity.name.function", "support.function"],
        mode === "dark" ? "#7aa2f7" : "#2e7de9",
      );
    const secondary = findTokenColor(
      tokenColors,
      ["keyword.control", "storage.type", "keyword"],
      colors["terminal.ansiMagenta"] || accent,
    );

    return {
      bg,
      bgElevated: colors["editor.background"]
        ? shade(bg, mode === "dark" ? 0.04 : 0.02)
        : bg,
      bgInset: inset,
      border,
      borderStrong: shade(border, mode === "dark" ? 0.18 : -0.15),
      text,
      textMuted:
        colors["descriptionForeground"] ||
        colors["editorLineNumber.foreground"] ||
        shade(text, mode === "dark" ? -0.3 : 0.3),
      textFaint: shade(text, mode === "dark" ? -0.5 : 0.5),
      accent,
      secondary,
      amber: findTokenColor(
        tokenColors,
        ["constant.numeric", "number"],
        colors["terminal.ansiYellow"] || "#e0af68",
      ),
      success:
        colors["terminal.ansiGreen"] ||
        findTokenColor(tokenColors, ["string"], "#9ece6a"),
      danger:
        colors["terminal.ansiRed"] ||
        colors["errorForeground"] ||
        findTokenColor(tokenColors, ["keyword.control"], "#f7768e"),
    };
  }

  async function applyPalette() {
    const id = activeThemeId();
    const loader = bundledThemes[id];
    if (!loader) return;
    const mod = await loader();
    const shikiTheme = "default" in mod ? (mod as any).default : mod;
    const raw = extractPalette(shikiTheme, theme);

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
    root.setProperty(
      "--focus-ring",
      withAlpha(raw.accent, theme === "dark" ? 0.4 : 0.35),
    );
    root.setProperty(
      "--wave-color",
      shade(raw.accent, theme === "dark" ? -0.45 : 0.5),
    );
    root.setProperty("--wave-progress-color", raw.accent);

    waveformRef?.refreshThemeColors();
  }

  function selectTheme(id: BundledTheme) {
    const info = themeInfoById.get(id);
    if (!info) return;
    if (info.type === "light") {
      lightThemeId = id;
      localStorage.setItem("lightThemeId", id);
    } else {
      darkThemeId = id;
      localStorage.setItem("darkThemeId", id);
    }
    void applyPalette();
    showAccentMenu = false;
    themeSearch = "";
  }

  function filteredThemeList() {
    const list = theme === "dark" ? darkThemes : lightThemes;
    const q = themeSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => t.displayName.toLowerCase().includes(q));
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
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void handleSaveProject();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      if (e.shiftKey) {
        toggleSynthMute();
      } else {
        toggleTrackMute();
      }
    }
  }

  function handleWindowClick(e: MouseEvent) {
    if (
      showSynthMenu &&
      !(e.target as HTMLElement).closest(".synth-dropdown")
    ) {
      showSynthMenu = false;
    }
    if (
      showAccentMenu &&
      !(e.target as HTMLElement).closest(".accent-dropdown")
    ) {
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
    updateSettings({ oscillator: value }, { silent: true });
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
    updateSettings({ synthMuted }, { silent: true });
  }

  function toggleTrackMute() {
    trackMuted = !trackMuted;
    waveformRef?.setTrackMuted(trackMuted);
    updateSettings({ trackMuted }, { silent: true });
  }

  async function handleSaveProject() {
    try {
      await projectStore.save();
    } catch (error) {
      console.error("Failed to save project", error);
      alert("Could not save project");
    }
  }

  onMount(() => {
    applyTheme();
    void applyPalette();
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
          title="Theme ({theme} mode)"
        >
          <Palette size={16} />
        </button>
        {#if showAccentMenu}
          <div class="dropdown-menu accent-menu">
            <input
              class="input-field accent-search"
              type="text"
              placeholder="Search {theme} themes…"
              bind:value={themeSearch}
            />
            <div class="accent-menu-list">
              {#each filteredThemeList() as t (t.id)}
                <button
                  class="dropdown-item"
                  class:active={activeThemeId() === t.id}
                  onclick={() => selectTheme(t.id as BundledTheme)}
                >
                  {t.displayName}
                  {#if activeThemeId() === t.id}<Check size={14} />{/if}
                </button>
              {:else}
                <div class="accent-menu-empty">No matching themes</div>
              {/each}
            </div>
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

  {#if showLoadModal}
    <LoadProjectModal
      onClose={() => (showLoadModal = false)}
      onSelect={(id) => {
        projectStore.load(id);
        showLoadModal = false;
      }}
    />
  {/if}

  {#if !projectStore.current}
    <section class="panel empty-panel">
      <div class="empty-state">
        <span class="empty-icon"><Music size={26} /></span>
        <div class="action-row">
          <button class="btn btn-primary" onclick={() => projectStore.create()}>
            <FilePlus size={16} /> New Project
          </button>
          <button
            class="btn btn-secondary"
            onclick={() => (showLoadModal = true)}
          >
            <FolderOpen size={16} /> Load Existing
          </button>
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
    <section class="panel panel-muted project-bar">
      <input
        type="text"
        bind:value={projectStore.current.name}
        oninput={() => (projectStore.dirty = true)}
        class="project-name-input"
        placeholder="Untitled project"
      />

      {#if projectStore.current.audio_file}
        <span class="audio-pill" title={projectStore.current.audio_file}>
          <Music size={16} />
          <span class="audio-pill-text">{projectStore.current.audio_file}</span>
        </span>
      {:else}
        <input type="file" onchange={handleAudioChange} class="file-input" />
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
        <button
          class="btn-ghost save-btn"
          onclick={handleSaveProject}
          title={projectStore.dirty
            ? "Save project (unsaved changes)"
            : "Save project"}
        >
          <Save size={16} />
          {#if projectStore.dirty}
            <span class="save-dirty-dot"></span>
          {/if}
        </button>
        <button
          class="btn-ghost btn-ghost-danger"
          onclick={() => projectStore.close()}
          title="Back to home"
        >
          <Home size={16} />
        </button>
      </div>
    </section>

    <section class="stage-panel">
      <Waveform
        bind:this={waveformRef}
        audioUrl={projectStore.audioUrl || ""}
        regionsData={projectStore.current.regions}
        onRegionChange={(e) => projectStore.updateRegion(e)}
        notesData={projectStore.current.notes}
        onNoteChange={(e) => {
          if ("action" in e && e.action === "delete") {
            projectStore.deleteNote(e.id);
          } else if (projectStore.current?.notes.some((n) => n.id === e.id)) {
            projectStore.updateNote(e.id, e.text);
          } else {
            projectStore.current!.notes.push({
              id: e.id,
              time: e.time,
              text: e.text,
            });
            projectStore.current!.notes.sort((a, b) => a.time - b.time);
          }
        }}
        initialZoom={projectStore.current.settings?.zoom}
        initialScrollPosition={projectStore.current.settings?.scrollPosition}
        initialPlayheadTime={projectStore.current.settings?.playheadTime}
        initialChordLength={projectStore.current.settings?.defaultChordLength}
        onZoomChange={(zoom: number) => updateSettings({ zoom })}
        onScrollChange={(scrollPosition: number) =>
          updateSettings({ scrollPosition })}
        onPlayheadChange={(playheadTime: number) =>
          updateSettings({ playheadTime })}
        onReady={applySettingsToController}
      />
    </section>

    <section class="panel panel-muted toolbar">
      <div class="toolbar-group">
        <button
          class="btn btn-play btn-icon"
          onclick={() => waveformRef?.playPause()}
          title="Play / pause"
        >
          {#if waveformRef?.isPlaying()}
            <Pause size={16} />
          {:else}
            <Play size={16} />
          {/if}
        </button>

        <button
          class="btn btn-primary"
          onclick={() => waveformRef?.addRegionAtCurrentTime("C")}
        >
          <Plus size={16} /> Add Chord
        </button>

        <div class="chord-length-control" title="Default length for new chords">
          <input
            type="number"
            min="0.2"
            step="0.1"
            bind:value={defaultChordLength}
            oninput={updateDefaultChordLength}
            class="input-field chord-length-input"
            style="width: {Math.max(
              2.4,
              String(defaultChordLength).length * 0.62 + 1.35,
            )}rem"
          />
          <span class="chord-length-suffix">s</span>
        </div>

        <button
          class="btn btn-outline btn-note"
          onclick={() => waveformRef?.addNoteAtCurrentTime()}
        >
          <StickyNote size={16} /> Add Note
        </button>

        <button
          class="btn-ghost"
          title="Search notes"
          onclick={() => waveformRef?.openNoteSearch()}
        >
          <Search size={16} />
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
          <button
            class="btn-ghost"
            onclick={toggleSynthMute}
            title="Mute synth"
          >
            {#if synthMuted}<VolumeX size={16} />{:else}<Volume2
                size={16}
              />{/if}
          </button>
          <span class="volume-tag">Synth</span>
          <input
            type="range"
            min="-40"
            max="20"
            bind:value={synthVolume}
            oninput={() => {
              waveformRef?.setSynthVolume(synthVolume);
              updateSettings({ synthVolume }, { silent: true });
            }}
            class="range-control range-compact"
          />
        </div>

        <div class="volume-control volume-track">
          <button
            class="btn-ghost"
            onclick={toggleTrackMute}
            title="Mute track"
          >
            {#if trackMuted}<VolumeX size={16} />{:else}<Volume2
                size={16}
              />{/if}
          </button>
          <span class="volume-tag">Track</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            bind:value={trackVolume}
            oninput={() => {
              waveformRef?.setTrackVolume(trackVolume);
              updateSettings({ trackVolume }, { silent: true });
            }}
            class="range-control range-compact"
          />
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <div class="dropdown synth-dropdown">
        <button
          class="btn btn-outline synth-dropdown-btn"
          onclick={toggleSynthMenu}
        >
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
          onChange={() =>
            updateSettings({ aiSettings: { ...aiSettings } }, { silent: true })}
        />
      {/if}
    </section>
  {/if}
</main>
