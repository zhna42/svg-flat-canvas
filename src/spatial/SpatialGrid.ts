export class SpatialGrid {
  private cellSize: number;
  private cells: Map<number, Map<string, Set<string>>> = new Map();

  public constructor(cellSize = 100) {
    this.cellSize = cellSize;
  }

  public cellKeys(x: number, y: number, w: number, h: number): number[] {
    const keys: number[] = [];
    const colStart = Math.floor(x / this.cellSize);
    const colEnd = Math.floor((x + w) / this.cellSize);
    const rowStart = Math.floor(y / this.cellSize);
    const rowEnd = Math.floor((y + h) / this.cellSize);
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        keys.push(r * 100000 + c);
      }
    }
    return keys;
  }

  public insert(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): number[] {
    const keys = this.cellKeys(x, y, w, h);
    for (const k of keys) {
      let cell = this.cells.get(k);
      if (!cell) {
        cell = new Map<string, Set<string>>();
        this.cells.set(k, cell);
      }
      cell.set(id, new Set<string>());
    }
    return keys;
  }

  public remove(id: string, x: number, y: number, w: number, h: number): void {
    for (const k of this.cellKeys(x, y, w, h)) {
      const cell = this.cells.get(k);
      if (cell) cell.delete(id);
    }
  }

  public removeById(id: string, oldCellIds: number[]): void {
    for (const k of oldCellIds) {
      const cell = this.cells.get(k);
      if (cell) cell.delete(id);
    }
  }

  public updateElement(
    id: string,
    oldCellIds: number[],
    x: number,
    y: number,
    w: number,
    h: number,
  ): number[] {
    for (const k of oldCellIds) {
      const cell = this.cells.get(k);
      if (cell) cell.delete(id);
    }

    const newKeys = this.cellKeys(x, y, w, h);
    for (const k of newKeys) {
      let cell = this.cells.get(k);
      if (!cell) {
        cell = new Map<string, Set<string>>();
        this.cells.set(k, cell);
      }
      cell.set(id, new Set<string>());
    }
    return newKeys;
  }

  public query(x: number, y: number, w: number, h: number): string[] {
    const seen = new Set<string>();
    for (const k of this.cellKeys(x, y, w, h)) {
      const cell = this.cells.get(k);
      if (cell) {
        for (const id of cell.keys()) {
          seen.add(id);
        }
      }
    }
    return Array.from(seen);
  }

  public clear(): void {
    this.cells.clear();
  }
}
