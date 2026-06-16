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

export interface SnapCircle {
  cx: number;
  cy: number;
  r: number;
}

const SNAP_DISTANCE_PX = 16;
const SNAP_RELEASE_DISTANCE_PX = 24;
const SNAP_PULL_BREAK_DISTANCE_PX = 400;

export class SvgSnap {
  private active: Partial<Record<SnapAxis, boolean>> = {};
  private blocked: Partial<Record<SnapAxis, boolean>> = {};
  private pull: Record<SnapAxis, number> = { x: 0, y: 0 };

  private snapLines: SnapLine[] = [];
  private snapNodes: { x: number; y: number }[] = [];
  private snapCircles: SnapCircle[] = [];

  get isActiveX(): boolean {
    return Boolean(this.active.x);
  }

  get isActiveY(): boolean {
    return Boolean(this.active.y);
  }

  reset(): void {
    this.active = {};
    this.blocked = {};
    this.pull = { x: 0, y: 0 };
    this.snapLines = [];
    this.snapNodes = [];
    this.snapCircles = [];
  }

  updatePull(deltaXPx: number, deltaYPx: number): void {
    if (this.active.x) this.pull.x += Math.abs(deltaXPx);
    if (this.active.y) this.pull.y += Math.abs(deltaYPx);
    if (this.pull.x > SNAP_PULL_BREAK_DISTANCE_PX) this.resetAxis('x', true);
    if (this.pull.y > SNAP_PULL_BREAK_DISTANCE_PX) this.resetAxis('y', true);
  }

  buildTargetLinesAndNodes(elementsPoints: { x: number; y: number }[][]): void {
    this.snapLines = [];
    this.snapNodes = [];
    this.snapCircles = [];

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

  buildTargetCircles(circles: SnapCircle[]): void {
    for (const c of circles) {
      this.snapCircles.push(c);
    }
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

  computeCorrection(movingPoints: { x: number; y: number }[]): SnapResult {
    let bestCorrX = 0;
    let bestCorrY = 0;
    let bestDist = Infinity;

    for (const mPt of movingPoints) {
      for (const tNode of this.snapNodes) {
        const dist = Math.hypot(mPt.x - tNode.x, mPt.y - tNode.y);

        if (dist < SNAP_DISTANCE_PX && dist < bestDist) {
          bestDist = dist;
          bestCorrX = tNode.x - mPt.x;
          bestCorrY = tNode.y - mPt.y;
        }
      }
    }

    if (bestDist === Infinity) {
      for (const mPt of movingPoints) {
        for (const circle of this.snapCircles) {
          const dx = mPt.x - circle.cx;
          const dy = mPt.y - circle.cy;
          const distToCenter = Math.hypot(dx, dy);

          if (distToCenter === 0) continue;

          const closestX = circle.cx + (dx / distToCenter) * circle.r;
          const closestY = circle.cy + (dy / distToCenter) * circle.r;

          const dist = Math.hypot(mPt.x - closestX, mPt.y - closestY);

          if (dist < SNAP_DISTANCE_PX && dist < bestDist) {
            bestDist = dist;
            bestCorrX = closestX - mPt.x;
            bestCorrY = closestY - mPt.y;
          }
        }
      }
    }

    if (bestDist === Infinity) {
      for (const pt of movingPoints) {
        for (const line of this.snapLines) {
          const abX = line.x2 - line.x;
          const abY = line.y2 - line.y;
          const apX = pt.x - line.x;
          const apY = pt.y - line.y;

          const abLenSq = abX * abX + abY * abY;
          if (abLenSq === 0) continue;

          let t = (apX * abX + apY * abY) / abLenSq;
          t = Math.max(0, Math.min(1, t));

          const closestX = line.x + t * abX;
          const closestY = line.y + t * abY;

          const dist = Math.hypot(pt.x - closestX, pt.y - closestY);

          if (dist < SNAP_DISTANCE_PX && dist < bestDist) {
            bestDist = dist;
            bestCorrX = closestX - pt.x;
            bestCorrY = closestY - pt.y;
          }
        }
      }
    }

    if (bestDist === Infinity) {
      this.resetAxis('x');
      this.resetAxis('y');
      return { correctionX: 0, correctionY: 0 };
    }

    return {
      correctionX: this.resolveAxis('x', bestCorrX, bestDist, false),
      correctionY: this.resolveAxis('y', bestCorrY, bestDist, false),
    };
  }

  private resetAxis(axis: SnapAxis, block = false): void {
    this.active[axis] = false;
    this.pull[axis] = 0;
    if (block) this.blocked[axis] = true;
  }

  private resolveAxis(
    axis: SnapAxis,
    correction: number,
    distance: number,
    _isOtherAxisSnapped: boolean,
  ): number {
    if (distance >= SNAP_DISTANCE_PX) {
      this.resetAxis(axis);
      return 0;
    }

    if (this.blocked[axis]) {
      if (distance > SNAP_RELEASE_DISTANCE_PX) {
        this.blocked[axis] = false;
      }
      return 0;
    }

    const maxDistance = this.active[axis]
      ? SNAP_RELEASE_DISTANCE_PX
      : SNAP_DISTANCE_PX;

    if (distance >= maxDistance) {
      this.resetAxis(axis);
      return 0;
    }

    this.active[axis] = true;
    this.pull[axis] = 0;
    return correction;
  }
}
