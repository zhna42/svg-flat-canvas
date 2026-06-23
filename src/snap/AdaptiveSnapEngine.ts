export type SnapAxis = 'x' | 'y';

export interface SnapResult {
  correctionX: number;
  correctionY: number;
}

export interface SnapLine {
  x: number;
  y: number;
  x2: number;
  y2: number;
  isOrthogonal: boolean;
}

export interface ScreenBezierSeg {
  p0x: number;
  p0y: number;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  p3x?: number;
  p3y?: number;
  type: 'cubic' | 'quadratic';
}

export interface CurveTarget {
  type: 'circle' | 'ellipse' | 'bezier';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  bezierSegs?: ScreenBezierSeg[];
}

const SLOW_ENGAGE_DIST = 10;
const SLOW_HOLD_DIST = 12;

const FAST_ENGAGE_DIST = 2;
const FAST_HOLD_DIST = 3;

const SLOW_SPEED = 2;
const FAST_SPEED = 14;

const VELOCITY_SMOOTH = 0.35;

export class AdaptiveSnapEngine {
  private active: Partial<Record<SnapAxis, boolean>> = {};

  private snapLines: SnapLine[] = [];
  private snapNodes: { x: number; y: number }[] = [];
  private curveTargets: CurveTarget[] = [];

  private onCurve = false;

  private smoothSpeed = 0;
  private dirX = 0;
  private dirY = 0;
  private dirLen = 0;

  get isActiveX(): boolean {
    return Boolean(this.active.x);
  }

  get isActiveY(): boolean {
    return Boolean(this.active.y);
  }

  reset(): void {
    this.active = {};
    this.snapLines = [];
    this.snapNodes = [];
    this.curveTargets = [];
    this.onCurve = false;
    this.smoothSpeed = 0;
    this.dirX = 0;
    this.dirY = 0;
    this.dirLen = 0;
  }

  setMotionContext(screenDeltaX: number, screenDeltaY: number): void {
    const rawSpeed = Math.hypot(screenDeltaX, screenDeltaY);
    this.smoothSpeed =
      VELOCITY_SMOOTH * rawSpeed + (1 - VELOCITY_SMOOTH) * this.smoothSpeed;

    const len = Math.hypot(screenDeltaX, screenDeltaY);
    if (len > 0.01) {
      this.dirX = screenDeltaX / len;
      this.dirY = screenDeltaY / len;
      this.dirLen = len;
    } else {
      this.dirLen = 0;
    }
  }

  private engageDist(): number {
    if (this.smoothSpeed <= SLOW_SPEED) return SLOW_ENGAGE_DIST;
    if (this.smoothSpeed >= FAST_SPEED) return FAST_ENGAGE_DIST;
    const t = (this.smoothSpeed - SLOW_SPEED) / (FAST_SPEED - SLOW_SPEED);
    return SLOW_ENGAGE_DIST + t * (FAST_ENGAGE_DIST - SLOW_ENGAGE_DIST);
  }

  private holdDist(): number {
    if (this.smoothSpeed <= SLOW_SPEED) return SLOW_HOLD_DIST;
    if (this.smoothSpeed >= FAST_SPEED) return FAST_HOLD_DIST;
    const t = (this.smoothSpeed - SLOW_SPEED) / (FAST_SPEED - SLOW_SPEED);
    return SLOW_HOLD_DIST + t * (FAST_HOLD_DIST - SLOW_HOLD_DIST);
  }

  private directionalPenalty(
    mx: number,
    my: number,
    tx: number,
    ty: number,
  ): number {
    if (this.dirLen < 0.5) return 1.0;
    const tdx = tx - mx;
    const tdy = ty - my;
    const tLen = Math.hypot(tdx, tdy);
    if (tLen < 0.01) return 1.0;
    const alignment = (tdx / tLen) * this.dirX + (tdy / tLen) * this.dirY;
    if (alignment >= 0.15) return 1.0;
    const penalty = 1.0 + (0.15 - alignment) * 2.8;
    return Math.min(penalty, 4.0);
  }

  private axisMisalignPenalty(corrX: number, corrY: number): number {
    if (this.dirLen < 0.5) return 1.0;
    const absCorrX = Math.abs(corrX);
    const absCorrY = Math.abs(corrY);
    if (absCorrX < 1 && absCorrY < 1) return 1.0;

    const absDirX = Math.abs(this.dirX);
    const absDirY = Math.abs(this.dirY);

    if (absDirX > absDirY * 1.8 && absCorrY > absCorrX * 1.8) {
      return 3.0;
    }
    if (absDirY > absDirX * 1.8 && absCorrX > absCorrY * 1.8) {
      return 3.0;
    }
    return 1.0;
  }

  buildTargetLinesAndNodes(elementsPoints: { x: number; y: number }[][]): void {
    this.snapLines = [];
    this.snapNodes = [];

    for (const points of elementsPoints) {
      if (points.length === 0) continue;

      let centerX = 0;
      let centerY = 0;

      for (const pt of points) {
        this.snapNodes.push({ x: pt.x, y: pt.y });
        centerX += pt.x;
        centerY += pt.y;
      }

      this.snapNodes.push({
        x: centerX / points.length,
        y: centerY / points.length,
      });

      if (points.length < 2) continue;

      for (let i = 0; i < points.length; i++) {
        const pt1 = points[i];
        const pt2 = points[(i + 1) % points.length];

        const isOrthogonal = pt1.x === pt2.x || pt1.y === pt2.y;

        this.snapLines.push({
          x: pt1.x,
          y: pt1.y,
          x2: pt2.x,
          y2: pt2.y,
          isOrthogonal,
        });
      }
    }
  }

  buildCurveTargets(curves: CurveTarget[]): void {
    this.curveTargets = curves;
  }

  buildArtboardLines(screenBBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): void {
    const { x, y, width, height } = screenBBox;
    const l = x,
      r = x + width,
      t = y,
      b = y + height;

    const lines = [
      { x: l, y: t, x2: r, y2: t },
      { x: l, y: b, x2: r, y2: b },
      { x: l, y: t, x2: l, y2: b },
      { x: r, y: t, x2: r, y2: b },
    ];

    for (const ln of lines) {
      this.snapLines.push({ ...ln, isOrthogonal: true });
    }
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): { dist: number; closestX: number; closestY: number } {
    const abX = bx - ax;
    const abY = by - ay;
    const apX = px - ax;
    const apY = py - ay;

    const abLenSq = abX * abX + abY * abY;
    if (abLenSq === 0) {
      const d = Math.hypot(px - ax, py - ay);
      return { dist: d, closestX: ax, closestY: ay };
    }

    let t = (apX * abX + apY * abY) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = ax + t * abX;
    const closestY = ay + t * abY;

    return {
      dist: Math.hypot(px - closestX, py - closestY),
      closestX,
      closestY,
    };
  }

  private projectToEllipse(
    px: number,
    py: number,
    curve: CurveTarget,
  ): { dist: number; snapX: number; snapY: number } {
    const dx = px - curve.cx;
    const dy = py - curve.cy;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
      return { dist: curve.rx, snapX: curve.cx + curve.rx, snapY: curve.cy };
    }
    const alpha = Math.atan2(dy, dx);
    const ex = curve.cx + curve.rx * Math.cos(alpha);
    const ey = curve.cy + curve.ry * Math.sin(alpha);
    return { dist: Math.hypot(ex - px, ey - py), snapX: ex, snapY: ey };
  }

  private projectToBezierSeg(
    px: number,
    py: number,
    seg: ScreenBezierSeg,
  ): { dist: number; snapX: number; snapY: number } {
    if (seg.type === 'quadratic') {
      return this.projectToQuadratic(px, py, seg);
    }
    return this.projectToCubic(px, py, seg);
  }

  private projectToQuadratic(
    px: number,
    py: number,
    seg: ScreenBezierSeg,
  ): { dist: number; snapX: number; snapY: number } {
    const { p0x, p0y, p1x, p1y, p2x, p2y } = seg;

    let bestT = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const mt = 1 - t;
      const bx = mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x;
      const by = mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y;
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
      const mt = 1 - t;
      const bx = mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x;
      const by = mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y;
      const d1x = 2 * mt * (p1x - p0x) + 2 * t * (p2x - p1x);
      const d1y = 2 * mt * (p1y - p0y) + 2 * t * (p2y - p1y);
      const d2x = 2 * (p2x - 2 * p1x + p0x);
      const d2y = 2 * (p2y - 2 * p1y + p0y);
      const fx = bx - px;
      const fy = by - py;
      const f = fx * d1x + fy * d1y;
      const df = d1x * d1x + d1y * d1y + fx * d2x + fy * d2y;
      if (Math.abs(df) < 1e-12) break;
      const tNext = t - f / df;
      if (tNext < 0 || tNext > 1) break;
      t = tNext;
    }

    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const mt = 1 - t;
    const rx = mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x;
    const ry = mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y;
    const rdx = rx - px;
    const rdy = ry - py;
    return { dist: Math.sqrt(rdx * rdx + rdy * rdy), snapX: rx, snapY: ry };
  }

  private projectToCubic(
    px: number,
    py: number,
    seg: ScreenBezierSeg,
  ): { dist: number; snapX: number; snapY: number } {
    const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y } = seg;
    const cp3x = p3x!;
    const cp3y = p3y!;

    let bestT = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const mt = 1 - t;
      const bx =
        mt * mt * mt * p0x +
        3 * mt * mt * t * p1x +
        3 * mt * t * t * p2x +
        t * t * t * cp3x;
      const by =
        mt * mt * mt * p0y +
        3 * mt * mt * t * p1y +
        3 * mt * t * t * p2y +
        t * t * t * cp3y;
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
      const mt = 1 - t;
      const bx =
        mt * mt * mt * p0x +
        3 * mt * mt * t * p1x +
        3 * mt * t * t * p2x +
        t * t * t * cp3x;
      const by =
        mt * mt * mt * p0y +
        3 * mt * mt * t * p1y +
        3 * mt * t * t * p2y +
        t * t * t * cp3y;
      const d1x =
        3 * mt * mt * (p1x - p0x) +
        6 * mt * t * (p2x - p1x) +
        3 * t * t * (cp3x - p2x);
      const d1y =
        3 * mt * mt * (p1y - p0y) +
        6 * mt * t * (p2y - p1y) +
        3 * t * t * (cp3y - p2y);
      const d2x =
        6 * mt * (p2x - 2 * p1x + p0x) + 6 * t * (cp3x - 2 * p2x + p1x);
      const d2y =
        6 * mt * (p2y - 2 * p1y + p0y) + 6 * t * (cp3y - 2 * p2y + p1y);
      const fx = bx - px;
      const fy = by - py;
      const f = fx * d1x + fy * d1y;
      const df = d1x * d1x + d1y * d1y + fx * d2x + fy * d2y;
      if (Math.abs(df) < 1e-12) break;
      const tNext = t - f / df;
      if (tNext < 0 || tNext > 1) break;
      t = tNext;
    }

    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const mt = 1 - t;
    const rx =
      mt * mt * mt * p0x +
      3 * mt * mt * t * p1x +
      3 * mt * t * t * p2x +
      t * t * t * cp3x;
    const ry =
      mt * mt * mt * p0y +
      3 * mt * mt * t * p1y +
      3 * mt * t * t * p2y +
      t * t * t * cp3y;
    const rdx = rx - px;
    const rdy = ry - py;
    return { dist: Math.sqrt(rdx * rdx + rdy * rdy), snapX: rx, snapY: ry };
  }

  private projectToCurve(
    px: number,
    py: number,
    curve: CurveTarget,
  ): { dist: number; snapX: number; snapY: number } {
    if (curve.type === 'bezier' && curve.bezierSegs) {
      let best: { dist: number; snapX: number; snapY: number } | null = null;
      for (const seg of curve.bezierSegs) {
        const r = this.projectToBezierSeg(px, py, seg);
        if (!best || r.dist < best.dist) best = r;
      }
      return best ?? { dist: Infinity, snapX: px, snapY: py };
    }
    return this.projectToEllipse(px, py, curve);
  }

  private buildMovingLines(
    movingPoints: { x: number; y: number }[],
  ): SnapLine[] {
    const lines: SnapLine[] = [];
    if (movingPoints.length < 2) return lines;
    for (let i = 0; i < movingPoints.length; i++) {
      const pt1 = movingPoints[i];
      const pt2 = movingPoints[(i + 1) % movingPoints.length];
      const isOrthogonal = pt1.x === pt2.x || pt1.y === pt2.y;
      lines.push({ x: pt1.x, y: pt1.y, x2: pt2.x, y2: pt2.y, isOrthogonal });
    }
    return lines;
  }

  computeCorrection(movingPoints: { x: number; y: number }[]): SnapResult {
    const engageDist = this.engageDist();
    const holdDist = this.holdDist();

    let bestCorrX = 0;
    let bestCorrY = 0;
    let bestDistX = Infinity;
    let bestDistY = Infinity;

    let bestNodeDist = Infinity;
    let bestCurveDist = Infinity;
    let bestLineDist = Infinity;

    let curveCorrX = 0;
    let curveCorrY = 0;

    for (const mPt of movingPoints) {
      for (const tNode of this.snapNodes) {
        const rawDist = Math.hypot(mPt.x - tNode.x, mPt.y - tNode.y);
        const corrX = tNode.x - mPt.x;
        const corrY = tNode.y - mPt.y;
        const dirPenalty = this.directionalPenalty(mPt.x, mPt.y, tNode.x, tNode.y);
        const axisPenalty = this.axisMisalignPenalty(corrX, corrY);
        const effectiveDist = rawDist * dirPenalty * axisPenalty;

        if (effectiveDist < engageDist && effectiveDist < bestNodeDist) {
          bestNodeDist = effectiveDist;
          bestDistX = Math.abs(corrX);
          bestDistY = Math.abs(corrY);
          bestCorrX = corrX;
          bestCorrY = corrY;
        }
      }
    }

    if (bestNodeDist === Infinity) {
      for (const pt of movingPoints) {
        for (const curve of this.curveTargets) {
          const snap = this.projectToCurve(pt.x, pt.y, curve);
          if (snap.dist < engageDist && snap.dist < bestCurveDist) {
            bestCurveDist = snap.dist;
            curveCorrX = snap.snapX - pt.x;
            curveCorrY = snap.snapY - pt.y;
            bestDistX = Math.abs(snap.snapX - pt.x);
            bestDistY = Math.abs(snap.snapY - pt.y);
          }
        }
      }
    }

    if (bestCurveDist !== Infinity) {
      if (this.onCurve) {
        if (bestCurveDist >= holdDist) {
          this.onCurve = false;
          this.active = {};
          return { correctionX: 0, correctionY: 0 };
        }
      } else {
        if (bestCurveDist >= engageDist) {
          return { correctionX: 0, correctionY: 0 };
        }
        this.onCurve = true;
      }
      this.active = { x: true, y: true };
      return { correctionX: curveCorrX, correctionY: curveCorrY };
    }

    this.onCurve = false;

    if (bestNodeDist === Infinity) {
      for (const pt of movingPoints) {
        for (const line of this.snapLines) {
          const { dist, closestX, closestY } = this.pointToSegmentDist(
            pt.x,
            pt.y,
            line.x,
            line.y,
            line.x2,
            line.y2,
          );

          if (dist < engageDist && dist < bestLineDist) {
            bestLineDist = dist;
            bestDistX = Math.abs(closestX - pt.x);
            bestDistY = Math.abs(closestY - pt.y);
            bestCorrX = closestX - pt.x;
            bestCorrY = closestY - pt.y;
          }
        }
      }

      const movingLines = this.buildMovingLines(movingPoints);
      for (const tNode of this.snapNodes) {
        for (const mLine of movingLines) {
          const { dist, closestX, closestY } = this.pointToSegmentDist(
            tNode.x,
            tNode.y,
            mLine.x,
            mLine.y,
            mLine.x2,
            mLine.y2,
          );

          if (dist < engageDist && dist < bestLineDist) {
            bestLineDist = dist;
            bestDistX = Math.abs(tNode.x - closestX);
            bestDistY = Math.abs(tNode.y - closestY);
            bestCorrX = tNode.x - closestX;
            bestCorrY = tNode.y - closestY;
          }
        }
      }
    }

    if (bestNodeDist === Infinity && bestLineDist === Infinity) {
      this.resetAxis('x');
      this.resetAxis('y');
      return { correctionX: 0, correctionY: 0 };
    }

    return {
      correctionX: this.resolveAxis(
        'x',
        bestCorrX,
        bestDistX,
        engageDist,
        holdDist,
      ),
      correctionY: this.resolveAxis(
        'y',
        bestCorrY,
        bestDistY,
        engageDist,
        holdDist,
      ),
    };
  }

  private resetAxis(axis: SnapAxis): void {
    this.active[axis] = false;
  }

  private isSlidingAlongAxis(axis: SnapAxis): boolean {
    if (this.dirLen < 0.5) return false;
    if (axis === 'x') {
      return Math.abs(this.dirY) > Math.abs(this.dirX) * 2.0;
    }
    return Math.abs(this.dirX) > Math.abs(this.dirY) * 2.0;
  }

  private resolveAxis(
    axis: SnapAxis,
    correction: number,
    distance: number,
    engageDist: number,
    holdDist: number,
  ): number {
    if (this.active[axis]) {
      const effectiveHold = this.isSlidingAlongAxis(axis)
        ? holdDist * 0.25
        : holdDist;
      if (distance >= effectiveHold) {
        this.resetAxis(axis);
        return 0;
      }
      return correction;
    }

    if (distance >= engageDist) {
      return 0;
    }

    this.active[axis] = true;
    return correction;
  }
}
