<script lang="ts">
  let { settings, onClose } = $props<{
    settings: { onset: number; frame: number; minNoteLen: number };
    onClose: () => void;
  }>();
</script>

<button
  type="button"
  class="modal-backdrop"
  onclick={onClose}
  aria-label="Close AI settings"
></button>

<div class="modal-card compact">
  <div class="modal-header">
    <h4 class="modal-title">AI Detection Settings</h4>
    <button class="close-ghost" onclick={onClose}>x</button>
  </div>

  <div class="field-group" style="margin-bottom: 0.8rem;">
    <div class="split-header" style="margin-bottom: 0.25rem;">
      <span class="micro-label">Detection Threshold</span>
      <span class="status-pill muted">{settings.onset}</span>
    </div>
    <input
      type="range"
      min="0.1"
      max="0.9"
      step="0.05"
      bind:value={settings.onset}
      class="range-control"
    />
    <p class="form-note">Higher values detect fewer, clearer note onsets.</p>
  </div>

  <div class="field-group" style="margin-bottom: 0.8rem;">
    <div class="split-header" style="margin-bottom: 0.25rem;">
      <span class="micro-label">Sustain Threshold</span>
      <span class="status-pill muted">{settings.frame}</span>
    </div>
    <input
      type="range"
      min="0.1"
      max="0.9"
      step="0.05"
      bind:value={settings.frame}
      class="range-control"
    />
    <p class="form-note">Higher values produce shorter note sustain windows.</p>
  </div>

  <div class="field-group" style="margin-bottom: 0.9rem;">
    <div class="split-header" style="margin-bottom: 0.25rem;">
      <span class="micro-label">Minimum Note Length (ms)</span>
      <span class="status-pill muted">{settings.minNoteLen}</span>
    </div>
    <input
      type="range"
      min="30"
      max="300"
      step="10"
      bind:value={settings.minNoteLen}
      class="range-control"
    />
  </div>

  <div class="action-row" style="justify-content: flex-end; margin-top: 0.4rem;">
    <button class="btn btn-primary" onclick={onClose}>Done</button>
  </div>
</div>
