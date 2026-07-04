import type { Point } from '@/types';
import type { HitTestableElement } from './types';

interface HitAreaEntry {
  points: Point[];
  dirty: boolean;
}

export class HitAreaCache {
  private readonly cache = new Map<string, HitAreaEntry>();

  ensureComputed(el: HitTestableElement): Point[] {
    let entry = this.cache.get(el.id);
    if (!entry) {
      entry = { points: [], dirty: true };
      this.cache.set(el.id, entry);
    }
    if (entry.dirty) {
      entry.points = el.getWorldHitPoints();
      entry.dirty = false;
    }
    return entry.points;
  }

  invalidate(id: string): void {
    const entry = this.cache.get(id);
    if (entry) entry.dirty = true;
  }

  remove(id: string): void {
    this.cache.delete(id);
  }
}
