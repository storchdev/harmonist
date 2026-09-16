<script lang="ts">
  import { FolderOpen, X, Search, Trash2, Music, Check } from "@lucide/svelte";
  import { Api } from "../lib/api";

  let {
    onClose,
    onSelect,
  }: { onClose: () => void; onSelect: (id: string) => void } = $props();

  type ProjectSummary = { id: string; name: string; last_modified?: string };

  let projects = $state<ProjectSummary[]>([]);
  let isLoading = $state(true);
  let search = $state("");
  let pendingDeleteId = $state<string | null>(null);

  async function refresh() {
    isLoading = true;
    try {
      projects = await Api.projects.list();
    } finally {
      isLoading = false;
    }
  }

  void refresh();

  function filtered() {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }

  async function confirmDelete(id: string) {
    await Api.projects.delete(id);
    projects = projects.filter((p) => p.id !== id);
    pendingDeleteId = null;
  }
</script>

<button
  type="button"
  class="modal-backdrop"
  onclick={onClose}
  aria-label="Close load project"
></button>

<div class="modal-card load-modal">
  <div class="modal-header">
    <h2 class="modal-title"><FolderOpen size={16} /> Load Project</h2>
    <button class="close-ghost" onclick={onClose}><X size={16} /></button>
  </div>

  <div class="load-search">
    <Search size={14} class="load-search-icon" />
    <input
      class="input-field load-search-input"
      type="text"
      placeholder="Search projects…"
      bind:value={search}
    />
  </div>

  <div class="load-project-list">
    {#if isLoading}
      <p class="dropdown-empty">Loading…</p>
    {:else if filtered().length === 0}
      <p class="dropdown-empty">
        {projects.length === 0 ? "No projects found yet." : "No projects match your search."}
      </p>
    {:else}
      {#each filtered() as p (p.id)}
        <div class="load-project-row">
          <button class="load-project-main" onclick={() => onSelect(p.id)}>
            <span class="load-project-icon"><Music size={15} /></span>
            <span class="load-project-info">
              <span class="load-project-name">{p.name}</span>
              {#if p.last_modified}
                <span class="load-project-date">{p.last_modified}</span>
              {/if}
            </span>
          </button>
          {#if pendingDeleteId === p.id}
            <div class="load-project-confirm">
              <span class="load-project-confirm-label">Delete?</span>
              <button
                class="icon-confirm-btn icon-confirm-yes"
                title="Confirm delete"
                onclick={() => confirmDelete(p.id)}
              >
                <Check size={14} />
              </button>
              <button
                class="icon-confirm-btn icon-confirm-no"
                title="Cancel"
                onclick={() => (pendingDeleteId = null)}
              >
                <X size={14} />
              </button>
            </div>
          {:else}
            <button
              class="btn-ghost btn-ghost-danger load-project-delete"
              title="Delete project"
              onclick={() => (pendingDeleteId = p.id)}
            >
              <Trash2 size={15} />
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
