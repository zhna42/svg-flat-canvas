import type { Point } from '@/types';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SpatialGrid } from '@/selection/SpatialGrid';

function pointInPolygon(px: number, py: number, poly: Point[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function rectIntersectsPoly(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  poly: Point[],
): boolean {
  // check if any poly point is inside rect
  for (const p of poly) {
    if (p.x >= rx && p.x <= rx + rw && p.y >= ry && p.y <= ry + rh) {
      return true;
    }
  }
  // check if any rect corner is inside poly
  const corners: Point[] = [
    { x: rx, y: ry },
    { x: rx + rw, y: ry },
    { x: rx + rw, y: ry + rh },
    { x: rx, y: ry + rh },
  ];
  for (const c of corners) {
    if (pointInPolygon(c.x, c.y, poly)) {
      return true;
    }
  }
  return false;
}

function rectContainsPoly(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  poly: Point[],
): boolean {
  for (const p of poly) {
    if (p.x < rx || p.x > rx + rw || p.y < ry || p.y > ry + rh) {
      return false;
    }
  }
  return true;
}

function polyInPoly(outer: Point[], inner: Point[]): boolean {
  for (const p of inner) {
    if (!pointInPolygon(p.x, p.y, outer)) {
      return false;
    }
  }
  return true;
}

export function hitTestPoint(
  px: number,
  py: number,
  elements: SvgElement[],
  grid: SpatialGrid,
): SvgElement[] {
  const size = 1;
  const ids = grid.query(px, py, size, size);
  const candidates = elements.filter((e) => ids.includes(e.id));

  const hits: SvgElement[] = [];
  for (const el of candidates) {
    const ha = el.hitArea;
    if (ha.length >= 3 && pointInPolygon(px, py, ha)) {
      hits.push(el);
    }
  }
  return hits;
}

export function hitTestRect(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  elements: SvgElement[],
  grid: SpatialGrid,
  requireFullContain: boolean,
): SvgElement[] {
  const ids = grid.query(rx, ry, rw, rh);
  const candidates = elements.filter((e) => ids.includes(e.id));

  return candidates.filter((el) => {
    const ha = el.hitArea;
    if (ha.length < 3) return false;
    if (requireFullContain) {
      return rectContainsPoly(rx, ry, rw, rh, ha);
    }
    return rectIntersectsPoly(rx, ry, rw, rh, ha);
  });
}

export function hitTestLasso(
  lassoPoints: Point[],
  elements: SvgElement[],
  grid: SpatialGrid,
): SvgElement[] {
  if (lassoPoints.length < 3) return [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of lassoPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const ids = grid.query(minX, minY, maxX - minX, maxY - minY);
  const candidates = elements.filter((e) => ids.includes(e.id));

  return candidates.filter((el) => {
    const ha = el.hitArea;
    if (ha.length < 3) return false;
    return polyInPoly(lassoPoints, ha);
  });
}
