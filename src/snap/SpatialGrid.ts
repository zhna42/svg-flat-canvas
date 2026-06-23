import type { BoundingBox } from './snap-types';

export class SpatialGrid {
  private cellSize: number;
  private cells: Map<number, Map<string, unknown>> = new Map();

  public constructor(cellSize = 100) {
    this.cellSize = cellSize;
  }

  private cellKeys(minX: number, minY: number, maxX: number, maxY: number): Set<number> {
    const keys = new Set<number>();
    const colStart = Math.floor(minX / this.cellSize);
    const colEnd = Math.floor(maxX / this.cellSize);
    const rowStart = Math.floor(minY / this.cellSize);
    const rowEnd = Math.floor(maxY / this.cellSize);
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        keys.add(r * 100000 + c);
      }
    }
    return keys;
  }

  public insert(id: string, minX: number, minY: number, maxX: number, maxY: number): void {
    for (const k of this.cellKeys(minX, minY, maxX, maxY)) {
      let cell = this.cells.get(k);
      if (!cell) {
        cell = new Map<string, unknown>();
        this.cells.set(k, cell);
      }
      cell.set(id, null);
    }
  }

  public remove(id: string, minX: number, minY: number, maxX: number, maxY: number): void {
    for (const k of this.cellKeys(minX, minY, maxX, maxY)) {
      const cell = this.cells.get(k);
      if (cell) cell.delete(id);
    }
  }

  public clear(): void {
    this.cells.clear();
  }

  public retrieve(bounds: BoundingBox): string[] {
    const seen = new Set<string>();
    for (const k of this.cellKeys(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)) {
      const cell = this.cells.get(k);
      if (cell) {
        for (const id of cell.keys()) {
          seen.add(id);
        }
      }
    }
    const result = new Array<string>(seen.size);
    let i = 0;
    for (const id of seen) {
      result[i++] = id;
    }
    return result;
  }
}
