import type { SvgCanvas } from '@/canvas/SvgCanvas';

export class ZOrderController {
  private readonly canvas: SvgCanvas;

  constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  raise(elementIds: string[]): void {
    const sorted = this._sortByIndex(elementIds);
    for (const id of sorted) {
      this.canvas.shapeManager.raise(id);
      this.canvas.view._elementIndex.raise(id);
    }
  }

  lower(elementIds: string[]): void {
    const sorted = this._sortByIndex(elementIds, true);
    for (const id of sorted) {
      this.canvas.shapeManager.lower(id);
      this.canvas.view._elementIndex.lower(id);
    }
  }

  raiseToTop(elementIds: string[]): void {
    const sorted = this._sortByIndex(elementIds);
    for (const id of sorted) {
      this.canvas.shapeManager.raiseToTop(id);
      this.canvas.view._elementIndex.raiseToTop(id);
    }
  }

  lowerToBottom(elementIds: string[]): void {
    const sorted = this._sortByIndex(elementIds, true);
    for (const id of sorted) {
      this.canvas.shapeManager.lowerToBottom(id);
      this.canvas.view._elementIndex.lowerToBottom(id);
    }
  }

  insertBefore(elementIds: string[], referenceId: string): void {
    const sorted = this._sortByIndex(elementIds, true);
    for (const id of sorted) {
      this.canvas.shapeManager.insertBefore(id, referenceId);
      this.canvas.view._elementIndex.insertBefore(id, referenceId);
    }
  }

  private _sortByIndex(ids: string[], descending = false): string[] {
    return [...ids].sort((a, b) => {
      const ia = this.canvas.view._elementIndex.getIndex(a);
      const ib = this.canvas.view._elementIndex.getIndex(b);
      return descending ? ib - ia : ia - ib;
    });
  }
}
