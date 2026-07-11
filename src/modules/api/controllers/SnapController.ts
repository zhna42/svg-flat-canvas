import type { SvgCanvas } from '@/canvas/SvgCanvas';

export class SnapController {
  constructor(private canvas: SvgCanvas) {}

  setSnapToCorners(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToCorners(enabled);
  }

  setSnapToPlanes(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToPlanes(enabled);
  }

  setSnapToArtboard(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToArtboard(enabled);
  }

  setAvoidCollisions(enabled: boolean): void {
    this.canvas.selectionHandler.setAvoidCollisions(enabled);
  }

  setSnapToGuidelines(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToGuidelines(enabled);
  }

  setSnapToGrid(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToGrid(enabled);
  }

  setSnapToElements(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToElements(enabled);
  }

  setLockDragAxis(enabled: boolean): void {
    this.canvas.selectionHandler.setLockDragAxis(enabled);
    this.canvas.events.emit('DRAG_AXIS_LOCK_CHANGED', { enabled });
  }

  setSnapAxis(mode: 'both' | 'horizontal' | 'vertical'): void {
    this.canvas.selectionHandler.setSnapAxis(mode);
  }
}
