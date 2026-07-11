import type { HitTestableElement } from './types';
import { SpatialGrid } from './SpatialGrid';

export class SpatialStore {
  private readonly grid: SpatialGrid;
  private readonly cellIds = new Map<string, number[]>();

  constructor(cellSize = 100) {
    this.grid = new SpatialGrid(cellSize);
  }

  insert(el: HitTestableElement): void {
    const bbox = el.getTransformedBBox();
    const ids = this.grid.insert(
      el.id,
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
    );
    this.cellIds.set(el.id, ids);
  }

  remove(id: string): void {
    const oldCellIds = this.cellIds.get(id);
    if (oldCellIds) {
      this.grid.removeById(id, oldCellIds);
      this.cellIds.delete(id);
    }
  }

  update(el: HitTestableElement): void {
    const bbox = el.getTransformedBBox();
    const oldCellIds = this.cellIds.get(el.id) ?? [];
    const newIds = this.grid.updateElement(
      el.id,
      oldCellIds,
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
    );
    this.cellIds.set(el.id, newIds);
  }

  query(x: number, y: number, w: number, h: number): string[] {
    return this.grid.query(x, y, w, h);
  }

  reindexAll(elements: HitTestableElement[]): void {
    this.grid.clear();
    this.cellIds.clear();
    for (const el of elements) {
      this.insert(el);
    }
  }
}
