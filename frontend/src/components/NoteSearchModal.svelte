<script lang="ts">
  import { Search, StickyNote, X } from "@lucide/svelte";
  import type { TimelineNote } from "../types";

  let {
    notes,
    onClose,
    onSelect,
  }: {
    notes: TimelineNote[];
    onClose: () => void;
    onSelect: (id: string) => void;
  } = $props();

  let search = $state("");

  function formatTime(t: number) {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function filtered() {
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((n) => n.text.trim().toLowerCase().includes(q));
  }

  function autofocus(node: HTMLElement) {
    node.focus();
  }
</script>

<button
  type="button"
  class="modal-backdrop"
  onclick={onClose}
  aria-label="Close note search"
></button>

<div class="modal-card load-modal">
  <div class="modal-header">
    <h2 class="modal-title"><StickyNote size={16} /> Search Notes</h2>
    <button class="close-ghost" onclick={onClose}><X size={16} /></button>
  </div>

  <div class="load-search">
    <Search size={14} class="load-search-icon" />
    <input
      use:autofocus
      class="input-field load-search-input"
      type="text"
      placeholder="Search note text…"
      bind:value={search}
    />
  </div>

  <div class="note-search-list">
    {#if notes.length === 0}
      <p class="dropdown-empty">No notes on this timeline yet.</p>
    {:else if filtered().length === 0}
      <p class="dropdown-empty">No notes match your search.</p>
    {:else}
      {#each filtered() as n (n.id)}
        <button class="note-search-row" onclick={() => onSelect(n.id)}>
          <span class="note-search-time">{formatTime(n.time)}</span>
          <span class="note-search-text">
            {n.text.trim() || "(empty note)"}
          </span>
        </button>
      {/each}
    {/if}
  </div>
</div>
