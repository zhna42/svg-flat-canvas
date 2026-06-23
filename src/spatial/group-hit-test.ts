import type { Point } from '@/types';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SpatialGrid } from '@/spatial/SpatialGrid';
import {
  pointInPolygon,
  rectContainsPoly,
  rectIntersectsPoly,
  polyInPoly,
} from '@/spatial/hit-test';

const hitElementAsFilled = (
  px: number,
  py: number,
  el: AbstractGraphicElement,
): boolean => {
  const ha = el.getWorldHitPoints();
  return ha.length >= 3 && pointInPolygon(px, py, ha);
};

const rectHitElementAsFilled = (
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  el: AbstractGraphicElement,
  requireFullContain: boolean,
): boolean => {
  const ha = el.getWorldHitPoints();
  if (ha.length < 3) return false;
  if (requireFullContain) return rectContainsPoly(rx, ry, rw, rh, ha);
  return rectIntersectsPoly(rx, ry, rw, rh, ha);
};

const lassoHitElementAsFilled = (
  polygon: Point[],
  el: AbstractGraphicElement,
): boolean => {
  const ha = el.getWorldHitPoints();
  return ha.length >= 3 && polyInPoly(polygon, ha);
};

export const hitTestGroupsByPoint = (
  px: number,
  py: number,
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  lookupGroup: (id: string) => string | undefined,
): string[] => {
  const size = 1;
  const ids = grid.query(px, py, size, size);
  const candidates = elements.filter((e) => ids.includes(e.id));

  const seen = new Set<string>();
  for (const el of candidates) {
    if (hitElementAsFilled(px, py, el)) {
      const gid = lookupGroup(el.id);
      if (gid) seen.add(gid);
    }
  }
  return Array.from(seen);
};

export const hitTestGroupsByRect = (
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  lookupGroup: (id: string) => string | undefined,
  requireFullContain: boolean,
): string[] => {
  const ids = grid.query(rx, ry, rw, rh);
  const candidates = elements.filter((e) => ids.includes(e.id));

  const seen = new Set<string>();
  for (const el of candidates) {
    if (rectHitElementAsFilled(rx, ry, rw, rh, el, requireFullContain)) {
      const gid = lookupGroup(el.id);
      if (gid) seen.add(gid);
    }
  }
  return Array.from(seen);
};

export const hitTestGroupsByLasso = (
  polygon: Point[],
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  lookupGroup: (id: string) => string | undefined,
): string[] => {
  if (polygon.length < 3) return [];

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const ids = grid.query(minX, minY, maxX - minX, maxY - minY);
  const candidates = elements.filter((e) => ids.includes(e.id));

  const seen = new Set<string>();
  for (const el of candidates) {
    if (lassoHitElementAsFilled(polygon, el)) {
      const gid = lookupGroup(el.id);
      if (gid) seen.add(gid);
    }
  }
  return Array.from(seen);
};
