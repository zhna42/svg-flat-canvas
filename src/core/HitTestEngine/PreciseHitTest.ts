import type { Point } from '@/types';

export const pointInPolygon = (
  px: number,
  py: number,
  poly: Point[],
): boolean => {
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
};

export const rectContainsPoly = (
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  poly: Point[],
): boolean => {
  for (const p of poly) {
    if (p.x < rx || p.x > rx + rw || p.y < ry || p.y > ry + rh) {
      return false;
    }
  }
  return true;
};

const segmentIntersectsRect = (
  a: Point,
  b: Point,
  left: number,
  right: number,
  top: number,
  bottom: number,
): boolean => {
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
  // eslint-disable-next-line no-constant-condition
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
};

export const rectIntersectsPoly = (
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  poly: Point[],
): boolean => {
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
};

export const polyInPoly = (outer: Point[], inner: Point[]): boolean => {
  for (const p of inner) {
    if (!pointInPolygon(p.x, p.y, outer)) return false;
  }
  return true;
};

export const segmentIntersectsSegment = (
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean => {
  const d1x = b.x - a.x,
    d1y = b.y - a.y;
  const d2x = d.x - c.x,
    d2y = d.y - c.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((c.x - a.x) * d2y - (c.y - a.y) * d2x) / cross;
  const u = ((c.x - a.x) * d1y - (c.y - a.y) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

export const polyIntersectsPoly = (polyA: Point[], polyB: Point[]): boolean => {
  for (const p of polyA) {
    if (pointInPolygon(p.x, p.y, polyB)) return true;
  }
  for (const p of polyB) {
    if (pointInPolygon(p.x, p.y, polyA)) return true;
  }
  const n = polyA.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const m = polyB.length;
    for (let k = 0, l = m - 1; k < m; l = k++) {
      if (segmentIntersectsSegment(polyA[i], polyA[j], polyB[k], polyB[l]))
        return true;
    }
  }
  return false;
};
