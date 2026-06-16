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
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
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
    if (p.x < rx || p.x > rx + rw || p.y < ry || p.y > ry + rh) return false;
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
    if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) return true;
  }
  const corners: Point[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  for (const c of corners) {
    if (pointInPolygon(c.x, c.y, poly)) return true;
  }
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (segmentIntersectsRect(poly[i], poly[j], left, right, top, bottom))
      return true;
  }
  return false;
}

function polyInPoly(outer: Point[], inner: Point[]): boolean {
  for (const p of inner) {
    if (!pointInPolygon(p.x, p.y, outer)) return false;
  }
  return true;
}

/**
 * Hit-test a group element as if it has a fill — uses hitArea polygon directly
 * regardless of the element's actual fill/stroke.
 */
function hitElementAsFilled(
  px: number,
  py: number,
  el: AbstractGraphicElement,
): boolean {
  const ha = getTransformedHitArea(el);
  return ha.length >= 3 && pointInPolygon(px, py, ha);
}

function rectHitElementAsFilled(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  el: AbstractGraphicElement,
  requireFullContain: boolean,
): boolean {
  const ha = getTransformedHitArea(el);
  if (ha.length < 3) return false;
  if (requireFullContain) return rectContainsPoly(rx, ry, rw, rh, ha);
  return rectIntersectsPoly(rx, ry, rw, rh, ha);
}

function lassoHitElementAsFilled(
  polygon: Point[],
  el: AbstractGraphicElement,
): boolean {
  const ha = getTransformedHitArea(el);
  return ha.length >= 3 && polyInPoly(polygon, ha);
}

// ---- Group hit-test: checks elements via fill-mode, returns unique group IDs ----

export function hitTestGroupsPoint(
  px: number,
  py: number,
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  lookupGroup: (id: string) => string | undefined,
  _cameraGroup?: SVGGElement,
): string[] {
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
}

export function hitTestGroupsRect(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  lookupGroup: (id: string) => string | undefined,
  requireFullContain: boolean,
): string[] {
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
}

export function hitTestGroupsLasso(
  polygon: Point[],
  elements: AbstractGraphicElement[],
  grid: SpatialGrid,
  lookupGroup: (id: string) => string | undefined,
): string[] {
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
}
