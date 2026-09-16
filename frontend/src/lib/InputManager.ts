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
    const isPrevBoundary = e.key === "[";
    const isNextBoundary = e.key === "]";
    const isSpace = e.code === "Space";
    const isDelete = e.key === "Delete" || e.key === "Backspace";

    if (e.key === "Escape") {
      if (this.controller.hasSelectedRegion()) {
        e.preventDefault();
        this.controller.regions.select(null);
        return;
      }
      if (this.controller.hasSelectedNote()) {
        e.preventDefault();
        this.controller.deselectNote();
        return;
      }
    }

    if (isSpace) {
      e.preventDefault();
      this.controller.playPause();
      return;
    }

    if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      e.preventDefault();
      const dir = e.key === "-" || e.key === "_" ? -1 : 1;
      this.controller.modifyZoom(dir * 20);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      this.controller.selectNeighborRegion(e.shiftKey ? -1 : 1);
      return;
    }

    if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this.controller.addRegion("C");
      return;
    }

    if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      this.controller.addNoteAtCurrentTime("");
      this.controller.editSelectedNote();
      return;
    }

    if (
      !e.ctrlKey &&
      !e.metaKey &&
      (e.key === "Enter" || e.key.toLowerCase() === "e") &&
      this.controller.hasSelectedRegion()
    ) {
      e.preventDefault();
      this.controller.editSelected();
      return;
    }

    if (
      !e.ctrlKey &&
      !e.metaKey &&
      (e.key === "Enter" || e.key.toLowerCase() === "e") &&
      this.controller.hasSelectedNote()
    ) {
      e.preventDefault();
      this.controller.editSelectedNote();
      return;
    }

    if (isDelete && this.controller.hasSelectedNote()) {
      e.preventDefault();
      this.controller.deleteSelectedNote();
      return;
    }

    if (isPrevBoundary || isNextBoundary) {
      // [ / ] = Boundary Jump (not Ctrl+Arrow, which browsers intercept
      // for back/forward navigation)
      e.preventDefault();
      this.controller.seekToBoundary(isPrevBoundary ? -1 : 1);
      return;
    }

    // 1. REGION MODE (Precise Editing)
    if (this.controller.hasSelectedRegion()) {
      if (isLeft || isRight) {
        e.preventDefault();
        const dir = isLeft ? -1 : 1;

        if (e.shiftKey) {
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

      if (e.shiftKey) {
        // Shift = Small Step (NEW FEATURE)
        this.controller.seek(0.05 * dir);
      } else {
        // Normal = Normal Seek
        this.controller.seek(0.5 * dir);
      }
    }
  }
}
