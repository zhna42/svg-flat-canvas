import type { Point, BoundingBox } from '@/types';

export const approximateArc = (
  rx: number,
  ry: number,
  segments: number,
): Point[] => {
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (Math.PI / 2 / segments) * i;
    pts.push({ x: rx * Math.cos(angle), y: ry * Math.sin(angle) });
  }
  return pts;
};

export const offsetPolygon = (poly: Point[], offset: number): Point[] => {
  if (poly.length < 3) return poly;
  const n = poly.length;
  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const curr = poly[i];
    const next = poly[(i + 1) % n];
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
    const n1x = len1 > 0 ? -e1y / len1 : 0;
    const n1y = len1 > 0 ? e1x / len1 : 0;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y);
    const n2x = len2 > 0 ? -e2y / len2 : 0;
    const n2y = len2 > 0 ? e2x / len2 : 0;
    const bisX = n1x + n2x;
    const bisY = n1y + n2y;
    const bisLen = Math.sqrt(bisX * bisX + bisY * bisY);
    const scale = bisLen > 0 ? offset / bisLen : offset;
    result.push({ x: curr.x + bisX * scale, y: curr.y + bisY * scale });
  }
  return result;
};

export const offsetOpenPath = (poly: Point[], offset: number): Point[] => {
  const dir = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): { dx: number; dy: number } => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { dx: 0, dy: 0 };
    return { dx: dx / len, dy: dy / len };
  };

  const perp = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): { nx: number; ny: number } => {
    const d = dir(ax, ay, bx, by);
    return { nx: -d.dy * offset, ny: d.dx * offset };
  };

  const miter = (
    p: Point,
    pnx: number,
    pny: number,
    nnx: number,
    nny: number,
  ): Point => {
    const mx = (pnx + nnx) / 2;
    const my = (pny + nny) / 2;
    const len = Math.sqrt(mx * mx + my * my);
    if (len === 0) return { x: p.x + pnx, y: p.y + pny };
    const scale = offset / len;
    return { x: p.x + mx * scale, y: p.y + my * scale };
  };
  if (poly.length < 2) return poly;
  const left: Point[] = [];
  const right: Point[] = [];

  const startDir = dir(poly[0].x, poly[0].y, poly[1].x, poly[1].y);
  const startN = { nx: -startDir.dy * offset, ny: startDir.dx * offset };
  left.push({
    x: poly[0].x + startN.nx - startDir.dx * offset,
    y: poly[0].y + startN.ny - startDir.dy * offset,
  });
  left.push({ x: poly[0].x + startN.nx, y: poly[0].y + startN.ny });

  for (let i = 1; i < poly.length - 1; i++) {
    const pn = perp(poly[i - 1].x, poly[i - 1].y, poly[i].x, poly[i].y);
    const nn = perp(poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y);
    left.push(miter(poly[i], pn.nx, pn.ny, nn.nx, nn.ny));
  }

  const endDir = dir(
    poly[poly.length - 2].x,
    poly[poly.length - 2].y,
    poly[poly.length - 1].x,
    poly[poly.length - 1].y,
  );
  const endN = { nx: -endDir.dy * offset, ny: endDir.dx * offset };
  left.push({
    x: poly[poly.length - 1].x + endN.nx,
    y: poly[poly.length - 1].y + endN.ny,
  });
  right.push({
    x: poly[poly.length - 1].x + endDir.dx * offset - endN.nx,
    y: poly[poly.length - 1].y + endDir.dy * offset - endN.ny,
  });
  right.push({
    x: poly[poly.length - 1].x - endN.nx,
    y: poly[poly.length - 1].y - endN.ny,
  });

  for (let i = poly.length - 2; i >= 1; i--) {
    const pn = perp(poly[i - 1].x, poly[i - 1].y, poly[i].x, poly[i].y);
    const nn = perp(poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y);
    right.push(miter(poly[i], -pn.nx, -pn.ny, -nn.nx, -nn.ny));
  }

  right.push({ x: poly[0].x - startN.nx, y: poly[0].y - startN.ny });
  right.push({
    x: poly[0].x - startDir.dx * offset - startN.nx,
    y: poly[0].y - startDir.dy * offset - startN.ny,
  });
  return [...left, ...right];
};

export const flattenPointsTransform = (
  pts: Point[],
  oldBBox: BoundingBox,
  newBBox: BoundingBox,
): Point[] => {
  const cx = newBBox.x + newBBox.width / 2,
    cy = newBBox.y + newBBox.height / 2;
  const oldCx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const oldCy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.map((p) => ({
    x: cx + (p.x - oldCx) * (newBBox.width / (oldBBox.width || 1)),
    y: cy + (p.y - oldCy) * (newBBox.height / (oldBBox.height || 1)),
  }));
};
