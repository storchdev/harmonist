import type { WaveformController } from "./WaveformController.svelte";

export class InputManager {
  private controller: WaveformController;

  constructor(controller: WaveformController, container: HTMLElement) {
    this.controller = controller;
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
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    const isLeft = e.key === "ArrowLeft" || e.key.toLowerCase() === "h";
    const isRight = e.key === "ArrowRight" || e.key.toLowerCase() === "l";
    const isSpace = e.code === "Space";
    const isDelete = e.key === "Delete" || e.key === "Backspace";

    if (isSpace) {
      e.preventDefault();
      this.controller.playPause();
      return;
    }

    // 1. REGION MODE (Precise Editing)
    if (this.controller.hasSelectedRegion()) {
      if (isLeft || isRight) {
        e.preventDefault();
        const dir = isLeft ? -1 : 1;

        if (e.ctrlKey) {
          this.controller.regions.selectNeighbor(dir);
        } else if (e.shiftKey) {
          // Shift in Region Mode = Resize
          this.controller.regions.nudgeSelected(dir, "resize");
        } else {
          // Arrows in Region Mode = Move
          this.controller.regions.nudgeSelected(dir, "move");
        }
        return;
      }

      if (isDelete) {
        e.preventDefault();
        this.controller.deleteSelected();
        return;
      }
    }

    // 2. GLOBAL MODE (Navigation)
    // Applies when NO region is selected OR keys don't match region ops
    if (isLeft || isRight) {
      const dir = isLeft ? -1 : 1;

      if (e.ctrlKey) {
        // Ctrl = Boundary Jump
        this.controller.seekToBoundary(dir);
      } else if (e.shiftKey) {
        // Shift = Small Step (NEW FEATURE)
        this.controller.seek(0.05 * dir);
      } else {
        // Normal = Normal Seek
        this.controller.seek(0.5 * dir);
      }
    }
  }
}
