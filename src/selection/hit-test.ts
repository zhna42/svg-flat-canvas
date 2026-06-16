import type { Point } from '@/types';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SpatialGrid } from '@/selection/SpatialGrid';

function getTransformedHitArea(el: AbstractGraphicElement): Point[] {
  const ha = el.hitArea;
  return ha.map((p) => el.transformPoint(p));
}

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

function segmentIntersectsRect(
  a: Point,
  b: Point,
  left: number,
  right: number,
  top: number,
  bottom: number,
): boolean {
  const INSIDE = 0,
    LEFT = 1,
    RIGHT = 2,
    BOTTOM = 4,
    TOP = 8;
  const code = (p: Point): number => {
    let c = INSIDE;
    if (p.x < left) c |= LEFT;
    else if (p.x > right) c |= RIGHT;
    if (p.y < top) c |= TOP;
    else if (p.y > bottom) c |= BOTTOM;
    return c;
  };
  let ca = code(a),
    cb = code(b);
  while (true) {
    if ((ca | cb) === 0) return true;
    if ((ca & cb) !== 0) return false;
    const out = ca !== 0 ? ca : cb;
    let p: Point;
    if (out & TOP)
      p = { x: a.x + ((b.x - a.x) * (top - a.y)) / (b.y - a.y), y: top };
    else if (out & BOTTOM)
      p = { x: a.x + ((b.x - a.x) * (bottom - a.y)) / (b.y - a.y), y: bottom };
    else if (out & RIGHT)
      p = { x: right, y: a.y + ((b.y - a.y) * (right - a.x)) / (b.x - a.x) };
    else p = { x: left, y: a.y + ((b.y - a.y) * (left - a.x)) / (b.x - a.x) };
    if (out === ca) {
      a = p;
      ca = code(a);
    } else {
      b = p;
      cb = code(b);
    }
  }
}

function rectIntersectsPoly(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  poly: Point[],
): boolean {
  const left = rx,
    right = rx + rw,
    top = ry,
    bottom = ry + rh;

  for (const p of poly) {
    if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) {
      return true;
    }
  }

  const corners: Point[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  for (const c of corners) {
    if (pointInPolygon(c.x, c.y, poly)) {
      return true;
    }
  }

  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (segmentIntersectsRect(poly[i], poly[j], left, right, top, bottom)) {
      return true;
    }
  }

  return false;
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
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  _cameraGroup?: SVGGElement,
): AbstractGraphicElement[] {
  const size = 1;
  const ids = grid.query(px, py, size, size);
  const candidates = elements.filter((e) => ids.includes(e.id));

  const hits: AbstractGraphicElement[] = [];
  for (const el of candidates) {
    const ha = getTransformedHitArea(el);
    if (ha.length >= 3 && pointInPolygon(px, py, ha)) {
      hits.push(el);
    }
  }

  // hits sorted by z-order from spatial grid order
  return hits;
}

export function hitTestRect(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  requireFullContain: boolean,
): AbstractGraphicElement[] {
  const ids = grid.query(rx, ry, rw, rh);
  const candidates = elements.filter((e) => ids.includes(e.id));

  return candidates.filter((el) => {
    const ha = getTransformedHitArea(el);
    if (ha.length < 3) return false;
    if (requireFullContain) {
      return rectContainsPoly(rx, ry, rw, rh, ha);
    }
    return rectIntersectsPoly(rx, ry, rw, rh, ha);
  });
}

export function hitTestLasso(
  lassoPoints: Point[],
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
): AbstractGraphicElement[] {
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
    const ha = getTransformedHitArea(el);
    if (ha.length < 3) return false;
    return polyInPoly(lassoPoints, ha);
  });
}
