export class SpatialGrid {
  private cellSize: number;
  private cells: Map<number, Map<string, Set<string>>> = new Map();

  public constructor(_width?: number, _height?: number, cellSize = 100) {
    this.cellSize = cellSize;
  }

  private cellKeys(x: number, y: number, w: number, h: number): Set<number> {
    const keys = new Set<number>();
    const colStart = Math.floor(x / this.cellSize);
    const colEnd = Math.floor((x + w) / this.cellSize);
    const rowStart = Math.floor(y / this.cellSize);
    const rowEnd = Math.floor((y + h) / this.cellSize);
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        keys.add(r * 100000 + c);
      }
    }
    return keys;
  }

  public insert(id: string, x: number, y: number, w: number, h: number): void {
    for (const k of this.cellKeys(x, y, w, h)) {
      let cell = this.cells.get(k);
      if (!cell) {
        cell = new Map<string, Set<string>>();
        this.cells.set(k, cell);
      }
      cell.set(id, new Set<string>());
    }
  }

  public remove(id: string, x: number, y: number, w: number, h: number): void {
    for (const k of this.cellKeys(x, y, w, h)) {
      const cell = this.cells.get(k);
      if (cell) cell.delete(id);
    }
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
