import type { Point, BoundingBox } from '@/types';

export class HitAreaBox {
  minX = 0;
  minY = 0;
  maxX = 0;
  maxY = 0;
  private dirty = true;
  private computeFn: (() => Point[]) | null = null;

  setComputeFn(fn: () => Point[]): void {
    this.computeFn = fn;
    this.dirty = true;
  }

  invalidate(): void {
    this.dirty = true;
  }

  getOrCompute(): HitAreaBox {
    if (!this.dirty) return this;
    if (this.computeFn) {
      const pts = this.computeFn();
      if (pts.length === 0) {
        this.minX = this.minY = this.maxX = this.maxY = 0;
      } else {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
      }
    }
    this.dirty = false;
    return this;
  }

  get width(): number {
    return this.maxX - this.minX;
  }

  get height(): number {
    return this.maxY - this.minY;
  }

  toBBox(): BoundingBox {
    return {
      x: this.minX,
      y: this.minY,
      width: this.width,
      height: this.height,
    };
  }

  containsPoint(px: number, py: number): boolean {
    return (
      px >= this.minX && px <= this.maxX && py >= this.minY && py <= this.maxY
    );
  }

  intersectsRect(rx: number, ry: number, rw: number, rh: number): boolean {
    return !(
      rx + rw < this.minX ||
      rx > this.maxX ||
      ry + rh < this.minY ||
      ry > this.maxY
    );
  }

  containsRect(rx: number, ry: number, rw: number, rh: number): boolean {
    return (
      rx >= this.minX &&
      ry >= this.minY &&
      rx + rw <= this.maxX &&
      ry + rh <= this.maxY
    );
  }
}
