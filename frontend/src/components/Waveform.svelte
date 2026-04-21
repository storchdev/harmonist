<script lang="ts">
  import { onMount } from "svelte";
  import { WaveformController } from "../lib/WaveformController.svelte";
  import { Api } from "../lib/api";
  import type { ChordRegion } from "../types";
  import { Chord } from "@tonaljs/tonal";
  import { parseChordInput } from "../lib/chordParsing";

  let { audioUrl, regionsData, onRegionChange } = $props<{
    audioUrl: string;
    regionsData: ChordRegion[];
    onRegionChange: (e: any) => void;
  }>();

  let container = $state<HTMLElement>();
  let controller = $state<WaveformController>();

  // UI States
  let aiResult = $state<{ notes: string[]; name: string } | null>(null);
  let editState = $state<{
    id: string;
    value: string;
    octave: number;
    comment: string;
  } | null>(null);
  let contextMenu = $state<{ x: number; y: number; regionId: string } | null>(
    null,
  );
  let currentZoom = $state(50);
  let scrollPosition = $state(0);
  let maxScroll = $state(1);
  let canScroll = $state(false);

  // Validation State
  let isInvalid = $state(false);

  onMount(() => {
    if (!container) return;

    controller = new WaveformController(container, {
      onRegionChange: (e) => onRegionChange(e),
      onUserInteraction: () => {
        aiResult = null;
        contextMenu = null;
      },
      onShowContextMenu: (e, id) => {
        contextMenu = { x: e.clientX, y: e.clientY, regionId: id };
      },
      onEditRegion: (id) => startEditing(id),
    });

    const unsubscribeScroll = controller.onScrollStateChange((state) => {
      scrollPosition = state.position;
      maxScroll = state.max > 0 ? state.max : 1;
      canScroll = state.canScroll;
    });

    return () => {
      unsubscribeScroll();
      controller?.destroy();
    };
  });

  $effect(() => {
    if (controller && audioUrl) controller.load(audioUrl);
  });
  $effect(() => {
    if (controller && controller.isReady && regionsData)
      controller.syncRegions(regionsData);
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
    if (editState) {
      if (e.key === "Enter") saveEdit(); // Quick save
      return;
    }
    controller?.handleShortcut(e);
  }

  function startEditing(id: string) {
    const r = regionsData.find((reg: ChordRegion) => reg.id === id);
    if (!r) return;
    editState = {
      id,
      value: r.chord_symbol,
      octave: r.octave || 4,
      comment: r.comment || "",
    };
    isInvalid = false; // Reset error
    contextMenu = null;
  }

  function saveEdit() {
    if (!editState || !controller) return;

    const cleanValue = editState.value.trim();
    const parsed = parseChordInput(cleanValue);

    if (!parsed.isValid) {
      isInvalid = true;
      return;
    }

    controller.updateRegionContent(
      editState.id,
      cleanValue,
      editState.octave,
      editState.comment,
    );
    editState = null;
  }

  function handleDeleteContext() {
    if (contextMenu && controller) {
      controller.deleteRegion(contextMenu.regionId);
      contextMenu = null;
    }
  }

  function closeEditor() {
    editState = null;
    isInvalid = false;
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="relative w-full panel panel-muted flex flex-col gap-3">
  <div bind:this={container} class="w-full min-h-[128px]"></div>

  <div class="waveform-controls">
    <div class="control-row control-row-scroll">
      <span class="micro-label">Timeline Scroll</span>
      <input
        type="range"
        min="0"
        max={maxScroll}
        value={scrollPosition}
        oninput={(e) =>
          controller?.setScrollPosition(
            Number((e.currentTarget as HTMLInputElement).value),
          )}
        class="range-control timeline-scroll-control"
        disabled={!canScroll}
      />
    </div>

    <div class="control-row control-row-zoom">
      <span class="micro-label">Zoom</span>
      <input
        type="range"
        min="10"
        max="300"
        bind:value={currentZoom}
        oninput={() => controller?.setZoom(currentZoom)}
        class="range-control zoom-control-compact"
      />
    </div>
  </div>

  {#if aiResult}
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div
        class="reveal rounded-2xl border px-6 py-3 shadow-2xl flex flex-col items-center"
        style="background: rgba(255, 248, 235, 0.95); border-color: rgba(177, 118, 30, 0.35); color: #4f3b1d"
      >
        <span class="micro-label" style="color: #9a6618">AI Detected</span>
        <div class="text-2xl font-bold mt-1" style="font-family: Fraunces, serif;">
          {aiResult.name}
        </div>
        <div class="text-sm mt-1 opacity-90" style="font-family: ui-monospace, monospace; color: #5f4e38;">
          {aiResult.notes.join(" - ") || "No notes"}
        </div>
      </div>
    </div>
  {/if}

  {#if editState}
    <button
      type="button"
      class="modal-backdrop"
      onclick={closeEditor}
      aria-label="Close chord editor"
    ></button>
    <div class="modal-card compact">
      <div class="modal-header">
        <h3 class="modal-title">Edit Chord Region</h3>
        <button class="close-ghost" onclick={closeEditor}>x</button>
      </div>

      <div class="field-group">
        <label class="micro-label" for="edit-chord-symbol">Chord Symbol</label>
        <input
          id="edit-chord-symbol"
          bind:value={editState.value}
          oninput={() => (isInvalid = false)}
          class="input-field"
          style={isInvalid
            ? "border-color: var(--danger); box-shadow: 0 0 0 4px rgba(162, 70, 70, 0.2);"
            : ""}
          placeholder="e.g. Cm7"
        />
        {#if isInvalid}
          <p class="form-note" style="color: #8f3f3f;">
            Please enter a valid chord symbol.
          </p>
        {/if}
      </div>

      <div class="field-group" style="margin-top: 0.8rem;">
        <div class="split-header" style="margin-bottom: 0;">
          <label class="micro-label" for="edit-chord-octave">Octave</label>
          <span class="status-pill muted">{editState.octave}</span>
        </div>
        <input
          id="edit-chord-octave"
          type="range"
          min="2"
          max="6"
          step="1"
          bind:value={editState.octave}
          class="range-control"
        />
      </div>

      <div class="field-group" style="margin-top: 0.8rem;">
        <label class="micro-label" for="edit-chord-comment">Comment</label>
        <input
          id="edit-chord-comment"
          bind:value={editState.comment}
          class="input-field"
          placeholder="Optional note for this chord"
        />
      </div>

      <div class="action-row" style="margin-top: 1rem; justify-content: flex-end;">
        <button class="btn btn-outline" onclick={closeEditor}>Cancel</button>
        <button class="btn btn-primary" onclick={saveEdit}>Save</button>
      </div>
    </div>
  {/if}

  {#if contextMenu}
    <div
      class="context-menu"
      style="top: {contextMenu.y}px; left: {contextMenu.x}px"
    >
      <button
        class="context-item"
        onclick={() => startEditing(contextMenu!.regionId)}>Edit Chord</button
      >
      <button
        class="context-item danger"
        onclick={handleDeleteContext}>Delete</button
      >
    </div>
    <button
      type="button"
      class="fixed inset-0 z-[99]"
      aria-label="Close context menu"
      onclick={() => (contextMenu = null)}
      oncontextmenu={(e) => {
        e.preventDefault();
        contextMenu = null;
      }}
    ></button>
  {/if}
</div>
