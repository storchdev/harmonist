<script lang="ts">
  import { Keyboard, X } from "@lucide/svelte";

  let { onClose } = $props<{ onClose: () => void }>();

  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: "Playback",
      rows: [
        ["Space", "Play / pause"],
        ["← / h", "Seek backward"],
        ["→ / l", "Seek forward"],
        ["Shift + ← / →", "Seek by small step"],
        ["Ctrl + ← / →", "Jump to previous / next region boundary"],
      ],
    },
    {
      title: "Selected region",
      rows: [
        ["← / →", "Move region"],
        ["Shift + ← / →", "Resize region"],
        ["Ctrl + ← / →", "Select neighboring region"],
        ["Delete / Backspace", "Delete region"],
      ],
    },
    {
      title: "Timeline",
      rows: [["Scroll", "Zoom in / out"]],
    },
  ];
</script>

<button
  type="button"
  class="modal-backdrop"
  onclick={onClose}
  aria-label="Close keyboard shortcuts"
></button>

<div class="modal-card">
  <div class="modal-header">
    <h2 class="modal-title"><Keyboard size={16} /> Keyboard Shortcuts</h2>
    <button class="close-ghost" onclick={onClose}><X size={16} /></button>
  </div>

  <div class="shortcut-groups">
    {#each groups as group}
      <div class="shortcut-group">
        <p class="micro-label">{group.title}</p>
        <div class="shortcut-list">
          {#each group.rows as [keys, desc]}
            <div class="shortcut-row">
              <span class="shortcut-desc">{desc}</span>
              <kbd class="shortcut-keys">{keys}</kbd>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
