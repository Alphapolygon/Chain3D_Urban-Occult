import type { CameraRig } from '../render/CameraRig';
import type { BreachPicking } from '../render/BreachPicking';
import type { BreachRenderer } from '../render/BreachRenderer';
import type { SoundEngine } from '../render/SoundEngine';
import type { BreachBoard } from '../sim/BreachBoard';

type BreachInputRuntime = {
  canInteract: () => boolean;
  board: () => BreachBoard;
  renderer: () => BreachRenderer;
  onPickCell: (cellIndex: number) => void;
  onPlace: (placementIndex: number, reason?: string) => boolean;
  onInvalid: (reason: string) => void;
  onVisualsRequested: () => void;
  invalidate: (boardChanged: boolean) => void;
  syncEnabled: () => void;
};

export class BreachPointerInput {
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerIsDown = false;
  private dragRotatedBreach = false;
  private dragExceededClickThreshold = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cameraRig: CameraRig,
    private readonly picking: BreachPicking,
    private readonly sfx: SoundEngine,
    private readonly runtime: BreachInputRuntime
  ) {}

  bind(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.sfx.init();
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerIsDown = true;
    this.dragRotatedBreach = false;
    this.dragExceededClickThreshold = false;
    this.runtime.syncEnabled();
    try { this.canvas.setPointerCapture(event.pointerId); } catch { }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerIsDown || !this.runtime.canInteract()) return;

    const totalDistance = Math.hypot(event.clientX - this.pointerDownX, event.clientY - this.pointerDownY);
    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    if (totalDistance <= 5 && !this.dragExceededClickThreshold) return;
    this.dragExceededClickThreshold = true;
    if (Math.abs(dx) + Math.abs(dy) <= 0) return;

    this.runtime.renderer().rotateByDrag(dx, dy);
    this.dragRotatedBreach = true;
    event.preventDefault();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const totalDistance = Math.hypot(event.clientX - this.pointerDownX, event.clientY - this.pointerDownY);
    const shouldTreatAsRotation = this.dragRotatedBreach || totalDistance > 5;
    this.pointerIsDown = false;
    try { this.canvas.releasePointerCapture(event.pointerId); } catch { }

    if (shouldTreatAsRotation) {
      this.dragRotatedBreach = false;
      this.dragExceededClickThreshold = false;
      this.runtime.invalidate(false);
      return;
    }

    if (!this.runtime.canInteract()) {
      this.runtime.syncEnabled();
      return;
    }

    const pick = this.picking.pick(event, this.canvas, this.cameraRig.camera, this.runtime.renderer(), this.runtime.board());
    if (!pick) {
      this.runtime.onInvalid('No Breach block under cursor. Click a visible cube face.');
      this.runtime.onVisualsRequested();
      this.runtime.invalidate(false);
      return;
    }

    this.runtime.onPickCell(pick.cellIndex);
    if (pick.placementIndex >= 0) {
      const placed = this.runtime.onPlace(pick.placementIndex, pick.reason);
      this.runtime.onVisualsRequested();
      this.runtime.invalidate(placed);
    } else {
      this.runtime.onInvalid(pick.reason ?? 'No valid empty placement cell around that block.');
      this.runtime.onVisualsRequested();
      this.runtime.invalidate(false);
    }
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.pointerIsDown = false;
    this.dragRotatedBreach = false;
    this.dragExceededClickThreshold = false;
    try { this.canvas.releasePointerCapture(event.pointerId); } catch { }
  };
}
