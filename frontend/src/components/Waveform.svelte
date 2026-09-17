<script lang="ts">
  import { onMount } from "svelte";
  import { WaveformController } from "../lib/WaveformController.svelte";
  import { Api } from "../lib/api";
  import type { ChordRegion, TimelineNote } from "../types";
  import { Chord } from "@tonaljs/tonal";
  import { parseChordInput } from "../lib/chordParsing";
  import { X, Pencil, Trash2, Sparkles, StickyNote } from "@lucide/svelte";

  let {
    audioUrl,
    regionsData,
    onRegionChange,
    notesData,
    onNoteChange,
    initialZoom,
    initialScrollPosition,
    initialChordLength,
    onZoomChange,
    onScrollChange,
    onReady,
  } = $props<{
    audioUrl: string;
    regionsData: ChordRegion[];
    onRegionChange: (e: any) => void;
    notesData: TimelineNote[];
    onNoteChange: (e: any) => void;
    initialZoom?: number;
    initialScrollPosition?: number;
    initialChordLength?: number;
    onZoomChange?: (zoom: number) => void;
    onScrollChange?: (position: number) => void;
    onReady?: () => void;
  }>();

  let container = $state<HTMLElement>();
  let panelEl = $state<HTMLElement>();
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
  let noteEditState = $state<{ id: string; text: string } | null>(null);
  let noteContextMenu = $state<{ x: number; y: number; noteId: string } | null>(
    null,
  );
  let currentZoom = $state(initialZoom ?? 50);
  let scrollPosition = $state(0);
  let maxScroll = $state(1);
  let canScroll = $state(false);
  let hasAppliedInitialViewState = false;

  // Validation State
  let isInvalid = $state(false);

  onMount(() => {
    if (!container) return;

    controller = new WaveformController(
      container,
      {
        onRegionChange: (e) => onRegionChange(e),
        onUserInteraction: () => {
          aiResult = null;
          contextMenu = null;
          noteContextMenu = null;
        },
        onShowContextMenu: (e, id) => {
          const panelRect = panelEl?.getBoundingClientRect();
          if (!panelRect) {
            contextMenu = { x: e.clientX, y: e.clientY, regionId: id };
            return;
          }

          contextMenu = {
            x: e.clientX - panelRect.left,
            y: e.clientY - panelRect.top,
            regionId: id,
          };
        },
        onEditRegion: (id) => startEditing(id),
        onNoteChange: (e) => onNoteChange(e),
        onEditNote: (id) => startEditingNote(id),
        onShowNoteContextMenu: (e, id) => {
          const panelRect = panelEl?.getBoundingClientRect();
          if (!panelRect) {
            noteContextMenu = { x: e.clientX, y: e.clientY, noteId: id };
            return;
          }

          noteContextMenu = {
            x: e.clientX - panelRect.left,
            y: e.clientY - panelRect.top,
            noteId: id,
          };
        },
      },
      { initialZoom, initialChordLength },
    );

    const unsubscribeScroll = controller.onScrollStateChange((state) => {
      maxScroll = state.max > 0 ? state.max : 1;
      canScroll = state.canScroll;
      if (state.zoom !== currentZoom) {
        currentZoom = state.zoom;
        onZoomChange?.(state.zoom);
      }
      if (state.position !== scrollPosition) {
        scrollPosition = state.position;
        onScrollChange?.(state.position);
      }
    });

    return () => {
      unsubscribeScroll();
      controller?.destroy();
    };
  });

  $effect(() => {
    const url = audioUrl;
    if (controller && url) {
      hasAppliedInitialViewState = false;
      controller.load(url);
    }
  });
  $effect(() => {
    if (controller && controller.isReady) {
      if (!hasAppliedInitialViewState) {
        hasAppliedInitialViewState = true;
        if (initialZoom !== undefined) {
          currentZoom = initialZoom;
          controller.setZoom(initialZoom);
        }
        if (initialScrollPosition) {
          scrollPosition = initialScrollPosition;
          controller.setScrollPosition(initialScrollPosition);
        }
      }
      onReady?.();
    }
  });
  $effect(() => {
    if (controller && controller.isReady && regionsData)
      controller.syncRegions(regionsData);
  });
  $effect(() => {
    if (controller && controller.isReady && notesData)
      controller.syncNotes(notesData);
  });

  // Public Actions
  export const playPause = () => controller?.playPause();
  export const isPlaying = () => controller?.isPlaying ?? false;
  export const addRegionAtCurrentTime = (c: string) => controller?.addRegion(c);
  export const addNoteAtCurrentTime = () => {
    controller?.addNoteAtCurrentTime("");
    controller?.editSelectedNote();
  };
  export const setSynthVolume = (v: number) => controller?.setSynthVolume(v);
  export const setTrackVolume = (v: number) => controller?.setTrackVolume(v);
  export const setSynthMuted = (muted: boolean) =>
    controller?.setSynthMuted(muted);
  export const setTrackMuted = (muted: boolean) =>
    controller?.setTrackMuted(muted);
  export const setOscillator = (t: string) => controller?.setOscillator(t);
  export const setDefaultChordLength = (v: number) =>
    controller?.setDefaultChordLength(v);
  export const refreshThemeColors = () => controller?.refreshThemeColors();

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
    if (noteEditState) {
      if (e.key === "Enter") saveNoteEdit();
      return;
    }
    controller?.handleShortcut(e);
  }

  function autofocus(node: HTMLElement) {
    node.focus();
    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement
    ) {
      node.select();
    }
  }

  function startEditing(id: string) {
    const r = regionsData.find((reg: ChordRegion) => reg.id === id);
    if (!r) return;
    editState = {
      id,
      value: r.chord_symbol,
      octave: r.octave ?? 4,
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

  function startEditingNote(id: string) {
    const n = notesData.find((note: TimelineNote) => note.id === id);
    if (!n) return;
    noteEditState = { id, text: n.text };
    contextMenu = null;
    noteContextMenu = null;
  }

  function saveNoteEdit() {
    if (!noteEditState || !controller) return;
    controller.updateNoteContent(noteEditState.id, noteEditState.text.trim());
    noteEditState = null;
  }

  function closeNoteEditor() {
    noteEditState = null;
    controller?.deselectNote();
  }

  function handleDeleteNoteContext() {
    if (noteContextMenu && controller) {
      controller.deleteNote(noteContextMenu.noteId);
      noteContextMenu = null;
    }
  }

  function formatTime(t: number) {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  bind:this={panelEl}
  class="relative w-full panel panel-muted flex flex-col gap-3"
>
  <div class="relative w-full min-h-[128px]">
    <div bind:this={container} class="w-full min-h-[128px]"></div>
    {#if audioUrl && !controller?.isReady}
      <div class="waveform-loading">
        <span class="spinner"></span>
        <span>Loading waveform…</span>
      </div>
    {/if}
  </div>

  <div class="waveform-controls">
    <div class="control-row control-row-scroll">
      <span class="timeline-time"
        >{formatTime(controller?.currentTime ?? 0)}</span
      >
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
      <span class="timeline-time">{formatTime(controller?.duration ?? 0)}</span>
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
        class="reveal flex flex-col items-center"
        style="background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 16px; padding: 0.75rem 1.5rem; box-shadow: var(--shadow-lg); color: var(--text)"
      >
        <span class="micro-label" style="color: var(--secondary)"
          ><Sparkles size={12} /> AI Detected</span
        >
        <div class="text-2xl font-bold mt-1">
          {aiResult.name}
        </div>
        <div
          class="text-sm mt-1"
          style="font-family: ui-monospace, monospace; color: var(--text-muted);"
        >
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
        <h3 class="modal-title"><Pencil size={16} /> Edit Chord Region</h3>
        <button class="close-ghost" onclick={closeEditor}
          ><X size={16} /></button
        >
      </div>

      <div class="field-group">
        <label class="micro-label" for="edit-chord-symbol">Chord Symbol</label>
        <input
          id="edit-chord-symbol"
          use:autofocus
          bind:value={editState.value}
          oninput={() => (isInvalid = false)}
          class="input-field"
          class:invalid={isInvalid}
          placeholder="e.g. Cm7"
        />
        {#if isInvalid}
          <p class="form-note danger">Please enter a valid chord symbol.</p>
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

      <div
        class="action-row"
        style="margin-top: 1rem; justify-content: flex-end;"
      >
        <button class="btn btn-outline" onclick={closeEditor}>Cancel</button>
        <button class="btn btn-primary" onclick={saveEdit}>Save</button>
      </div>
    </div>
  {/if}

  {#if noteEditState}
    <button
      type="button"
      class="modal-backdrop"
      onclick={closeNoteEditor}
      aria-label="Close note editor"
    ></button>
    <div class="modal-card compact">
      <div class="modal-header">
        <h3 class="modal-title"><StickyNote size={16} /> Edit Note</h3>
        <button class="close-ghost" onclick={closeNoteEditor}
          ><X size={16} /></button
        >
      </div>

      <div class="field-group">
        <label class="micro-label" for="edit-note-text">Note Text</label>
        <textarea
          id="edit-note-text"
          use:autofocus
          bind:value={noteEditState.text}
          class="input-field note-textarea"
          placeholder="Enter a note"
          rows="6"></textarea>
      </div>

      <div
        style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;"
      >
        <button class="btn btn-outline" onclick={closeNoteEditor}>Cancel</button
        >
        <button class="btn btn-primary" onclick={saveNoteEdit}>Save</button>
      </div>
    </div>
  {/if}

  {#if noteContextMenu}
    <div
      class="context-menu"
      style="top: {noteContextMenu.y}px; left: {noteContextMenu.x}px"
    >
      <button
        class="context-item"
        onclick={() => startEditingNote(noteContextMenu!.noteId)}
        ><Pencil size={14} /> Edit Note</button
      >
      <button class="context-item danger" onclick={handleDeleteNoteContext}
        ><Trash2 size={14} /> Delete</button
      >
    </div>
    <button
      type="button"
      class="fixed inset-0 z-[99]"
      aria-label="Close context menu"
      onclick={() => (noteContextMenu = null)}
      oncontextmenu={(e) => {
        e.preventDefault();
        noteContextMenu = null;
      }}
    ></button>
  {/if}

  {#if contextMenu}
    <div
      class="context-menu"
      style="top: {contextMenu.y}px; left: {contextMenu.x}px"
    >
      <button
        class="context-item"
        onclick={() => startEditing(contextMenu!.regionId)}
        ><Pencil size={14} /> Edit Chord</button
      >
      <button class="context-item danger" onclick={handleDeleteContext}
        ><Trash2 size={14} /> Delete</button
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
