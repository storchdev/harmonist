import type { WaveformController } from "./WaveformController.svelte";

export class InputManager {
  private controller: WaveformController;

  constructor(controller: WaveformController, container: HTMLElement) {
    this.controller = controller;
    this.setupKeyboard();
    this.setupScrollZoom(container);
  }

  private setupScrollZoom(container: HTMLElement) {
    container.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        this.controller.modifyZoom(delta);
      },
      { passive: false },
    );
  }

  public handleKeyDown(e: KeyboardEvent) {
    const isLeft = e.key === "ArrowLeft" || e.key.toLowerCase() === "h";
    const isRight = e.key === "ArrowRight" || e.key.toLowerCase() === "l";
    const isSpace = e.code === "Space";
    const isDelete = e.key === "Delete" || e.key === "Backspace";

    if (isSpace) {
      e.preventDefault();
      this.controller.playPause();
      return;
    }

    // Delegate to Controller to check state (Selected Region vs Global)
    if (this.controller.hasSelectedRegion()) {
      if (isLeft || isRight) {
        e.preventDefault();
        const dir = isLeft ? -1 : 1;
        if (e.ctrlKey) this.controller.regions.selectNeighbor(dir);
        else if (e.shiftKey)
          this.controller.regions.nudgeSelected(dir, "resize");
        else this.controller.regions.nudgeSelected(dir, "move");
        return;
      }

      if (isDelete) {
        e.preventDefault();
        this.controller.deleteSelected();
        return;
      }
    }

    // Global Navigation
    if (!e.ctrlKey && !e.shiftKey && (isLeft || isRight)) {
      const dir = isLeft ? -1 : 1;
      this.controller.seek(0.5 * dir);
    } else if (e.ctrlKey && (isLeft || isRight)) {
      // Boundary Jump
      const dir = isLeft ? -1 : 1;
      this.controller.seekToBoundary(dir);
    }
  }

  private setupKeyboard() {
    // Svelte window binding usually calls handleKeyDown,
    // but if we wanted self-contained, we'd add listener here.
    // For this refactor, we expose handleKeyDown to be called by Svelte <svelte:window>
  }
}
