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

const SNAP_DISTANCE_PX = 16;
const SNAP_RELEASE_DISTANCE_PX = 10;
const SNAP_PULL_BREAK_DISTANCE_PX = 80;

export class SvgSnap {
  private active: Partial<Record<SnapAxis, boolean>> = {};
  private blocked: Partial<Record<SnapAxis, boolean>> = {};
  private pull: Record<SnapAxis, number> = { x: 0, y: 0 };

  private snapLines: SnapLine[] = [];
  private snapNodes: { x: number; y: number }[] = [];

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
    let bestCorrX = 0;
    let bestCorrY = 0;
    let bestDistX = Infinity;
    let bestDistY = Infinity;

    // Храним минимальную общую дистанцию для приоритетов (Узлы важнее линий)
    let bestNodeDist = Infinity;
    let bestLineDist = Infinity;

    // ТИП 1: Точка в Точку (Node Snap) - Высший приоритет
    for (const mPt of movingPoints) {
      for (const tNode of this.snapNodes) {
        const dist = Math.hypot(mPt.x - tNode.x, mPt.y - tNode.y);

        if (dist < SNAP_DISTANCE_PX && dist < bestNodeDist) {
          bestNodeDist = dist;
          bestDistX = Math.abs(tNode.x - mPt.x);
          bestDistY = Math.abs(tNode.y - mPt.y);
          bestCorrX = tNode.x - mPt.x;
          bestCorrY = tNode.y - mPt.y;
        }
      }
    }

    // ТИП 2-3: Если узлы не замагнитились — проверяем линии (А) и рёбра (Б) вместе
    if (bestNodeDist === Infinity) {
      // ТИП 2: Направление А (Точки движущегося -> К линиям холста)
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

          if (dist < SNAP_DISTANCE_PX && dist < bestLineDist) {
            bestLineDist = dist;
            bestDistX = Math.abs(closestX - pt.x);
            bestDistY = Math.abs(closestY - pt.y);
            bestCorrX = closestX - pt.x;
            bestCorrY = closestY - pt.y;
          }
        }
      }

      // ТИП 3: Направление Б (Узлы холста -> К линиям движущегося элемента)
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

          if (dist < SNAP_DISTANCE_PX && dist < bestLineDist) {
            bestLineDist = dist;
            bestDistX = Math.abs(tNode.x - closestX);
            bestDistY = Math.abs(tNode.y - closestY);
            bestCorrX = tNode.x - closestX;
            bestCorrY = tNode.y - closestY;
          }
        }
      }
    }

    // Финальная проверка: если вообще ничего не замагнитилось
    if (bestNodeDist === Infinity && bestLineDist === Infinity) {
      this.resetAxis('x');
      this.resetAxis('y');
      return { correctionX: 0, correctionY: 0 };
    }

    // Возвращаем точные проекции осей для логики resolveAxis
    return {
      correctionX: this.resolveAxis('x', bestCorrX, bestDistX, false),
      correctionY: this.resolveAxis('y', bestCorrY, bestDistY, false),
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
