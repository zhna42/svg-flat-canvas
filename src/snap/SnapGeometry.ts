import type { Point, BezierSegment, EdgeInfo } from './snap-types';

export interface PointToSegmentResult {
  distSq: number;
  closestX: number;
  closestY: number;
  normalX: number;
  normalY: number;
  t: number;
}

export interface PointToEdgeSnapResult {
  distSq: number;
  snapX: number;
  snapY: number;
}

export class SnapGeometry {
  public static pointToSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): PointToSegmentResult {
    const abX = bx - ax;
    const abY = by - ay;
    const abLenSq = abX * abX + abY * abY;
    if (abLenSq < 1e-12) {
      const dx = px - ax;
      const dy = py - ay;
      const distSq = dx * dx + dy * dy;
      const len = Math.sqrt(distSq) || 1;
      return {
        distSq,
        closestX: ax,
        closestY: ay,
        normalX: dx / len,
        normalY: dy / len,
        t: 0,
      };
    }
    let t = ((px - ax) * abX + (py - ay) * abY) / abLenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t * abX;
    const cy = ay + t * abY;
    const dx = px - cx;
    const dy = py - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      distSq: dx * dx + dy * dy,
      closestX: cx,
      closestY: cy,
      normalX: dx / len,
      normalY: dy / len,
      t,
    };
  }

  public static snapMovingPointToStaticEdge(
    mx: number,
    my: number,
    edge: EdgeInfo,
  ): PointToEdgeSnapResult | null {
    const seg = this.pointToSegment(mx, my, edge.ax, edge.ay, edge.bx, edge.by);
    return { distSq: seg.distSq, snapX: seg.closestX, snapY: seg.closestY };
  }

  public static snapMovingEdgeToStaticVertex(
    mx1: number,
    my1: number,
    mx2: number,
    my2: number,
    svx: number,
    svy: number,
  ): PointToEdgeSnapResult | null {
    const seg = this.pointToSegment(svx, svy, mx1, my1, mx2, my2);
    return { distSq: seg.distSq, snapX: svx, snapY: svy };
  }

  public static projectToEllipse(
    px: number,
    py: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    strokeOffset: number,
  ): Point {
    const dx = px - cx;
    const dy = py - cy;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) {
      return { x: cx + rx + strokeOffset, y: cy };
    }
    const alpha = Math.atan2(dy, dx);
    const rxe = rx + strokeOffset;
    const rye = ry + strokeOffset;
    return {
      x: cx + rxe * Math.cos(alpha),
      y: cy + rye * Math.sin(alpha),
    };
  }

  public static snapToEllipseTangential(
    mx: number,
    my: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    strokeOffset: number,
  ): { distSq: number; snapX: number; snapY: number } | null {
    const dx = mx - cx;
    const dy = my - cy;
    const rxe = rx + strokeOffset;
    const rye = ry + strokeOffset;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) {
      return { distSq: rxe * rxe, snapX: cx + rxe, snapY: cy };
    }
    const alpha = Math.atan2(dy, dx);
    const ex = cx + rxe * Math.cos(alpha);
    const ey = cy + rye * Math.sin(alpha);
    const edx = ex - mx;
    const edy = ey - my;
    return { distSq: edx * edx + edy * edy, snapX: ex, snapY: ey };
  }

  public static snapToCircleQuadrants(
    mx: number,
    my: number,
    cx: number,
    cy: number,
    r: number,
    strokeOffset: number,
    rWorldSq: number,
  ): { distSq: number; snapX: number; snapY: number } | null {
    const re = r + strokeOffset;
    const quadrants: Array<{ x: number; y: number }> = [
      { x: cx + re, y: cy },
      { x: cx, y: cy + re },
      { x: cx - re, y: cy },
      { x: cx, y: cy - re },
    ];
    let bestDistSq = Infinity;
    let bestX = 0;
    let bestY = 0;
    for (let i = 0; i < 4; i++) {
      const q = quadrants[i];
      const dx = q.x - mx;
      const dy = q.y - my;
      const dsq = dx * dx + dy * dy;
      if (dsq < bestDistSq) {
        bestDistSq = dsq;
        bestX = q.x;
        bestY = q.y;
      }
    }
    if (bestDistSq >= rWorldSq) return null;
    return { distSq: bestDistSq, snapX: bestX, snapY: bestY };
  }

  private static quadraticBezier(
    t: number,
    p0: number,
    p1: number,
    p2: number,
  ): number {
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
  }

  private static quadraticDerivative(
    t: number,
    p0: number,
    p1: number,
    p2: number,
  ): number {
    const mt = 1 - t;
    return 2 * mt * (p1 - p0) + 2 * t * (p2 - p1);
  }

  private static quadraticSecondDerivative(
    p0: number,
    p1: number,
    p2: number,
  ): number {
    return 2 * (p2 - 2 * p1 + p0);
  }

  private static cubicBezier(
    t: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number,
  ): number {
    const mt = 1 - t;
    return (
      mt * mt * mt * p0 +
      3 * mt * mt * t * p1 +
      3 * mt * t * t * p2 +
      t * t * t * p3
    );
  }

  private static cubicDerivative(
    t: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number,
  ): number {
    const mt = 1 - t;
    return (
      3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2)
    );
  }

  private static cubicSecondDerivative(
    t: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number,
  ): number {
    const mt = 1 - t;
    return 6 * mt * (p2 - 2 * p1 + p0) + 6 * t * (p3 - 2 * p2 + p1);
  }

  public static projectToQuadraticBezier(
    px: number,
    py: number,
    seg: BezierSegment,
  ): { distSq: number; point: Point } {
    const p0x = seg.p0.x;
    const p0y = seg.p0.y;
    const p1x = seg.p1.x;
    const p1y = seg.p1.y;
    const p2x = seg.p2!.x;
    const p2y = seg.p2!.y;

    let bestT = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const bx = this.quadraticBezier(t, p0x, p1x, p2x);
      const by = this.quadraticBezier(t, p0y, p1y, p2y);
      const dx = bx - px;
      const dy = by - py;
      const dsq = dx * dx + dy * dy;
      if (dsq < bestDistSq) {
        bestDistSq = dsq;
        bestT = t;
      }
    }

    let t = bestT;
    for (let iter = 0; iter < 3; iter++) {
      const bx = this.quadraticBezier(t, p0x, p1x, p2x);
      const by = this.quadraticBezier(t, p0y, p1y, p2y);
      const dx = this.quadraticDerivative(t, p0x, p1x, p2x);
      const dy = this.quadraticDerivative(t, p0y, p1y, p2y);
      const ddx = this.quadraticSecondDerivative(p0x, p1x, p2x);
      const ddy = this.quadraticSecondDerivative(p0y, p1y, p2y);
      const fx = bx - px;
      const fy = by - py;
      const f = fx * dx + fy * dy;
      const df = dx * dx + dy * dy + fx * ddx + fy * ddy;
      if (Math.abs(df) < 1e-12) break;
      const tNext = t - f / df;
      if (tNext < 0 || tNext > 1) break;
      t = tNext;
    }

    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const rx = this.quadraticBezier(t, p0x, p1x, p2x);
    const ry = this.quadraticBezier(t, p0y, p1y, p2y);
    const rdx = rx - px;
    const rdy = ry - py;
    return { distSq: rdx * rdx + rdy * rdy, point: { x: rx, y: ry } };
  }

  public static projectToCubicBezier(
    px: number,
    py: number,
    seg: BezierSegment,
  ): { distSq: number; point: Point } {
    const p0x = seg.p0.x;
    const p0y = seg.p0.y;
    const p1x = seg.p1.x;
    const p1y = seg.p1.y;
    const p2x = seg.p2!.x;
    const p2y = seg.p2!.y;
    const p3x = seg.p3!.x;
    const p3y = seg.p3!.y;

    let bestT = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const bx = this.cubicBezier(t, p0x, p1x, p2x, p3x);
      const by = this.cubicBezier(t, p0y, p1y, p2y, p3y);
      const dx = bx - px;
      const dy = by - py;
      const dsq = dx * dx + dy * dy;
      if (dsq < bestDistSq) {
        bestDistSq = dsq;
        bestT = t;
      }
    }

    let t = bestT;
    for (let iter = 0; iter < 3; iter++) {
      const bx = this.cubicBezier(t, p0x, p1x, p2x, p3x);
      const by = this.cubicBezier(t, p0y, p1y, p2y, p3y);
      const dx = this.cubicDerivative(t, p0x, p1x, p2x, p3x);
      const dy = this.cubicDerivative(t, p0y, p1y, p2y, p3y);
      const ddx = this.cubicSecondDerivative(t, p0x, p1x, p2x, p3x);
      const ddy = this.cubicSecondDerivative(t, p0y, p1y, p2y, p3y);
      const fx = bx - px;
      const fy = by - py;
      const f = fx * dx + fy * dy;
      const df = dx * dx + dy * dy + fx * ddx + fy * ddy;
      if (Math.abs(df) < 1e-12) break;
      const tNext = t - f / df;
      if (tNext < 0 || tNext > 1) break;
      t = tNext;
    }

    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const rx = this.cubicBezier(t, p0x, p1x, p2x, p3x);
    const ry = this.cubicBezier(t, p0y, p1y, p2y, p3y);
    const rdx = rx - px;
    const rdy = ry - py;
    return { distSq: rdx * rdx + rdy * rdy, point: { x: rx, y: ry } };
  }

  public static projectToBezier(
    px: number,
    py: number,
    seg: BezierSegment,
  ): { distSq: number; point: Point } {
    if (seg.type === 'line') {
      const r = this.pointToSegment(
        px,
        py,
        seg.p0.x,
        seg.p0.y,
        seg.p1.x,
        seg.p1.y,
      );
      return { distSq: r.distSq, point: { x: r.closestX, y: r.closestY } };
    }
    if (seg.type === 'quadratic')
      return this.projectToQuadraticBezier(px, py, seg);
    return this.projectToCubicBezier(px, py, seg);
  }
}
