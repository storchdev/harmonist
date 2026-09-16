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
        ["[ / ]", "Jump to previous / next region boundary"],
        ["M", "Mute / unmute track"],
        ["Shift + M", "Mute / unmute synth"],
      ],
    },
    {
      title: "Chords",
      rows: [
        ["Tab / Shift + Tab", "Select next / previous chord"],
        ["A", "Add chord at playhead"],
        ["E / Enter", "Edit selected chord"],
        ["Esc", "Deselect chord"],
        ["Delete / Backspace", "Delete selected chord"],
      ],
    },
    {
      title: "Selected region",
      rows: [
        ["← / h · → / l", "Move region"],
        ["Shift + ← / →", "Move region (fine)"],
        ["Alt + ← / →", "Drag end time"],
        ["Alt + Shift + ← / →", "Drag end time (fine)"],
      ],
    },
    {
      title: "Notes",
      rows: [
        ["N", "Add note at playhead"],
        ["E / Enter", "Edit selected note"],
        ["Delete / Backspace", "Delete selected note"],
      ],
    },
    {
      title: "Timeline",
      rows: [
        ["Scroll", "Zoom in / out"],
        ["+ / -", "Zoom in / out"],
      ],
    },
    {
      title: "Vim motions",
      rows: [
        ["h", "Same as ←"],
        ["l", "Same as →"],
      ],
    },
    {
      title: "History",
      rows: [["Ctrl / Cmd + Z", "Undo last change"]],
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
