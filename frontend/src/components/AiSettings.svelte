<script lang="ts">
  let { settings, onClose } = $props<{
    settings: { onset: number; frame: number; minNoteLen: number };
    onClose: () => void;
  }>();
</script>

<div
  class="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm"
  onclick={onClose}
></div>

<div
  class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-5 z-[101]"
  onclick={(e) => e.stopPropagation()}
>
  <div class="flex justify-between items-center mb-4">
    <h4 class="text-sm font-bold text-white uppercase tracking-wider">
      AI Sensitivity
    </h4>
    <button class="text-gray-400 hover:text-white" onclick={onClose}>✕</button>
  </div>

  <div class="mb-4">
    <div class="flex justify-between text-xs mb-1">
      <span class="text-gray-300">Detection Thresh</span>
      <span class="text-indigo-300 font-mono">{settings.onset}</span>
    </div>
    <input
      type="range"
      min="0.1"
      max="0.9"
      step="0.05"
      bind:value={settings.onset}
      class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
    />
    <p class="text-[10px] text-gray-500 mt-1">Higher = Fewer, clearer notes</p>
  </div>

  <div class="mb-4">
    <div class="flex justify-between text-xs mb-1">
      <span class="text-gray-300">Sustain Thresh</span>
      <span class="text-indigo-300 font-mono">{settings.frame}</span>
    </div>
    <input
      type="range"
      min="0.1"
      max="0.9"
      step="0.05"
      bind:value={settings.frame}
      class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
    />
    <p class="text-[10px] text-gray-500 mt-1">Higher = Shorter sustain</p>
  </div>

  <div class="mb-4">
    <div class="flex justify-between text-xs mb-1">
      <span class="text-gray-300">Min Note (ms)</span>
      <span class="text-indigo-300 font-mono">{settings.minNoteLen}</span>
    </div>
    <input
      type="range"
      min="30"
      max="300"
      step="10"
      bind:value={settings.minNoteLen}
      class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
    />
  </div>

  <div class="pt-2 border-t border-gray-700 flex justify-end">
    <button
      class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded"
      onclick={onClose}>Done</button
    >
  </div>
</div>
