/* eslint-disable custom-rules/no-dom-api */

import type { Point } from '@/types';
import type {
  HitTestableElement,
  HitTestResult,
  QueryOptions,
  HitServiceResult,
  ServiceHandler,
} from './types';
import { SpatialStore } from './SpatialStore';
import { BBoxCache } from './BBoxCache';
import { HitAreaCache } from './HitAreaCache';
import { ServiceHitRegistry } from './ServiceHitRegistry';
import {
  pointInPolygon,
  rectContainsPoly,
  rectIntersectsPoly,
  polyInPoly,
} from './PreciseHitTest';

export class HitTestEngine {
  public readonly spatialStore: SpatialStore;
  private readonly bboxCache = new BBoxCache();
  private readonly hitAreaCache = new HitAreaCache();
  private readonly serviceRegistry = new ServiceHitRegistry();

  private elements: HitTestableElement[] = [];

  constructor(cellSize = 100) {
    this.spatialStore = new SpatialStore(cellSize);
  }

  // ── Service handlers (Level 0) ──

  registerServiceHandler(handler: ServiceHandler): void {
    this.serviceRegistry.register(handler);
  }

  removeServiceHandler(name: string): void {
    this.serviceRegistry.remove(name);
  }

  hitTestService(x: number, y: number): HitServiceResult | null {
    return this.serviceRegistry.hitTest(x, y);
  }

  // ── Element management ──

  insert(el: HitTestableElement): void {
    this.elements.push(el);
    this.spatialStore.insert(el);
  }

  remove(id: string): void {
    this.spatialStore.remove(id);
    this.bboxCache.remove(id);
    this.hitAreaCache.remove(id);
    this.elements = this.elements.filter((e) => e.id !== id);
  }

  update(el: HitTestableElement): void {
    this.spatialStore.update(el);
    this.bboxCache.invalidate(el.id);
    this.hitAreaCache.invalidate(el.id);
  }

  reindexAll(elements: HitTestableElement[]): void {
    this.elements = [...elements];
    this.spatialStore.reindexAll(elements);
  }

  invalidate(id: string): void {
    this.bboxCache.invalidate(id);
    this.hitAreaCache.invalidate(id);
  }

  setElements(elements: HitTestableElement[]): void {
    this.elements = elements;
  }

  // ── Level 1-3 queries ──

  queryPoint(px: number, py: number, opts?: QueryOptions): HitTestResult {
    const size = 1;
    const ids = this.spatialStore.query(px, py, size, size);
    const candidates = this.filterCandidates(ids);

    const hits: HitTestableElement[] = [];
    for (const el of candidates) {
      if (opts?.filter && !opts.filter(el)) continue;
      if (!this.bboxCache.containsPoint(el, px, py)) continue;
      const ha = this.hitAreaCache.ensureComputed(el);
      if (ha.length >= 3 && pointInPolygon(px, py, ha)) {
        hits.push(el);
      }
    }

    return { hits };
  }

  queryPointGroups(
    px: number,
    py: number,
    groupBy: (elementId: string) => string | undefined,
  ): string[] {
    const { hits } = this.queryPoint(px, py);
    const seen = new Set<string>();
    for (const el of hits) {
      const gid = groupBy(el.id);
      if (gid) seen.add(gid);
    }
    return Array.from(seen);
  }

  queryRect(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    opts?: QueryOptions,
  ): HitTestResult {
    const ids = this.spatialStore.query(rx, ry, rw, rh);
    const candidates = this.filterCandidates(ids);
    const requireFullContain = opts?.requireFullContain ?? false;

    const hits: HitTestableElement[] = [];
    for (const el of candidates) {
      if (opts?.filter && !opts.filter(el)) continue;

      if (requireFullContain) {
        if (!this.bboxCache.containsRect(el, rx, ry, rw, rh)) continue;
      } else {
        if (!this.bboxCache.intersectsRect(el, rx, ry, rw, rh)) continue;
      }

      const ha = this.hitAreaCache.ensureComputed(el);
      if (ha.length < 3) continue;

      if (requireFullContain) {
        if (rectContainsPoly(rx, ry, rw, rh, ha)) hits.push(el);
      } else {
        if (rectIntersectsPoly(rx, ry, rw, rh, ha)) hits.push(el);
      }
    }

    return { hits };
  }

  queryRectGroups(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    groupBy: (elementId: string) => string | undefined,
    requireFullContain: boolean,
  ): string[] {
    const { hits } = this.queryRect(rx, ry, rw, rh, { requireFullContain });
    const seen = new Set<string>();
    for (const el of hits) {
      const gid = groupBy(el.id);
      if (gid) seen.add(gid);
    }
    return Array.from(seen);
  }

  queryLasso(lassoPoints: Point[], opts?: QueryOptions): HitTestResult {
    if (lassoPoints.length < 3) return { hits: [] };

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of lassoPoints) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const ids = this.spatialStore.query(minX, minY, maxX - minX, maxY - minY);
    const candidates = this.filterCandidates(ids);

    const lassoW = maxX - minX;
    const lassoH = maxY - minY;

    const hits: HitTestableElement[] = [];
    for (const el of candidates) {
      if (opts?.filter && !opts.filter(el)) continue;
      if (!this.bboxCache.intersectsRect(el, minX, minY, lassoW, lassoH))
        continue;
      const ha = this.hitAreaCache.ensureComputed(el);
      if (ha.length < 3) continue;
      if (polyInPoly(lassoPoints, ha)) hits.push(el);
    }

    return { hits };
  }

  queryLassoGroups(
    lassoPoints: Point[],
    groupBy: (elementId: string) => string | undefined,
  ): string[] {
    const { hits } = this.queryLasso(lassoPoints);
    const seen = new Set<string>();
    for (const el of hits) {
      const gid = groupBy(el.id);
      if (gid) seen.add(gid);
    }
    return Array.from(seen);
  }

  // ── Helpers ──

  private filterCandidates(ids: string[]): HitTestableElement[] {
    const idSet = new Set(ids);
    return this.elements.filter((e) => idSet.has(e.id));
  }
}

export type { CollisionResult } from './types';
