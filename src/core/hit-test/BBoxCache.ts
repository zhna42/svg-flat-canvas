import type { HitTestableElement } from './types';

interface BBoxEntry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  dirty: boolean;
}

export class BBoxCache {
  private readonly cache = new Map<string, BBoxEntry>();

  ensureComputed(el: HitTestableElement): BBoxEntry {
    let entry = this.cache.get(el.id);
    if (!entry) {
      entry = { minX: 0, minY: 0, maxX: 0, maxY: 0, dirty: true };
      this.cache.set(el.id, entry);
    }
    if (entry.dirty) {
      const pts = el.getWorldHitPoints();
      if (pts.length === 0) {
        entry.minX = entry.minY = entry.maxX = entry.maxY = 0;
      } else {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        entry.minX = minX;
        entry.minY = minY;
        entry.maxX = maxX;
        entry.maxY = maxY;
      }
      entry.dirty = false;
    }
    return entry;
  }

  containsPoint(el: HitTestableElement, px: number, py: number): boolean {
    const b = this.ensureComputed(el);
    return px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
  }

  intersectsRect(
    el: HitTestableElement,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ): boolean {
    const b = this.ensureComputed(el);
    return !(
      rx + rw < b.minX ||
      rx > b.maxX ||
      ry + rh < b.minY ||
      ry > b.maxY
    );
  }

  containsRect(
    el: HitTestableElement,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ): boolean {
    const b = this.ensureComputed(el);
    return (
      rx >= b.minX && ry >= b.minY && rx + rw <= b.maxX && ry + rh <= b.maxY
    );
  }

  invalidate(id: string): void {
    const entry = this.cache.get(id);
    if (entry) entry.dirty = true;
  }

  remove(id: string): void {
    this.cache.delete(id);
  }
}
