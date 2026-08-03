import type { SvgCanvas } from '@/canvas/SvgCanvas';

export class SnapController {
  private _snapToPlanes = false;
  private _snapToCorners = false;

  constructor(private canvas: SvgCanvas) {}

  setSnapToCorners(enabled: boolean): void {
    this._snapToCorners = enabled;
    this.canvas.selectionHandler.setSnapToCorners(enabled);
    this.canvas.events.emit('SNAP_CORNERS_CHANGED', { enabled });
  }

  setSnapToPlanes(enabled: boolean): void {
    this._snapToPlanes = enabled;
    this.canvas.selectionHandler.setSnapToPlanes(enabled);
    this.canvas.events.emit('SNAP_PLANES_CHANGED', { enabled });
  }

  setSnapToArtboard(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToArtboard(enabled);
    this.canvas.events.emit('SNAP_ARTBOARD_CHANGED', { enabled });
    if (enabled) this._autoEnableCorners();
  }

  setAvoidCollisions(enabled: boolean): void {
    this.canvas.selectionHandler.setAvoidCollisions(enabled);
    this.canvas.events.emit('SNAP_AVOID_COLLISIONS_CHANGED', { enabled });
  }

  setSnapToGuidelines(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToGuidelines(enabled);
    this.canvas.events.emit('SNAP_GUIDELINES_CHANGED', { enabled });
    if (enabled) this._autoEnableCorners();
  }

  setSnapToGrid(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToGrid(enabled);
    this.canvas.events.emit('SNAP_GRID_CHANGED', { enabled });
    if (enabled) this._autoEnableCorners();
  }

  setSnapToElements(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToElements(enabled);
    this.canvas.events.emit('SNAP_ELEMENTS_CHANGED', { enabled });
    if (enabled) this._autoEnableCorners();
  }

  setLockDragAxis(enabled: boolean): void {
    this.canvas.selectionHandler.setLockDragAxis(enabled);
    this.canvas.events.emit('DRAG_AXIS_LOCK_CHANGED', { enabled });
  }

  setSnapAxis(mode: 'both' | 'horizontal' | 'vertical'): void {
    this.canvas.selectionHandler.setSnapAxis(mode);
    this.canvas.events.emit('SNAP_AXIS_CHANGED', { mode });
  }

  private _autoEnableCorners(): void {
    if (!this._snapToPlanes && !this._snapToCorners) {
      this.setSnapToCorners(true);
    }
  }
}
