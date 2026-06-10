export class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: Map<string, Set<string>>[];

  public constructor(width: number, height: number, cellSize = 100) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = new Map<string, Set<string>>();
    }
  }

  private key(col: number, row: number): number {
    return row * this.cols + col;
  }

  private cellKeys(x: number, y: number, w: number, h: number): Set<number> {
    const keys = new Set<number>();
    const colStart = Math.max(0, Math.floor(x / this.cellSize));
    const colEnd = Math.min(this.cols - 1, Math.floor((x + w) / this.cellSize));
    const rowStart = Math.max(0, Math.floor(y / this.cellSize));
    const rowEnd = Math.min(this.rows - 1, Math.floor((y + h) / this.cellSize));
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        keys.add(this.key(c, r));
      }
    }
    return keys;
  }

  public insert(id: string, x: number, y: number, w: number, h: number): void {
    for (const k of this.cellKeys(x, y, w, h)) {
      const cell = this.cells[k];
      cell.set(id, new Set<string>());
    }
  }

  public remove(id: string, x: number, y: number, w: number, h: number): void {
    for (const k of this.cellKeys(x, y, w, h)) {
      this.cells[k].delete(id);
    }
  }

  public query(x: number, y: number, w: number, h: number): string[] {
    const seen = new Set<string>();
    for (const k of this.cellKeys(x, y, w, h)) {
      for (const id of this.cells[k].keys()) {
        seen.add(id);
      }
    }
    return Array.from(seen);
  }

  public clear(): void {
    for (const cell of this.cells) {
      cell.clear();
    }
  }
}
