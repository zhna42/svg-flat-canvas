export type SnapResult = {
  correctionX: number;
  correctionY: number;
};

type SnapAxis = 'x' | 'y';

const SNAP_DISTANCE_PX = 16;
const SNAP_RELEASE_DISTANCE_PX = SNAP_DISTANCE_PX * 2;
const SNAP_PULL_BREAK_DISTANCE_PX = 24;

export class SvgSnap {
  private active: Partial<Record<SnapAxis, boolean>> = {};
  private blocked: Partial<Record<SnapAxis, boolean>> = {};
  private pull: Record<SnapAxis, number> = { x: 0, y: 0 };
  private snapLines: { x: number; y: number; x2: number; y2: number }[] = [];

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
  }

  updatePull(deltaXPx: number, deltaYPx: number): void {
    if (this.active.x) this.pull.x += Math.abs(deltaXPx);
    if (this.active.y) this.pull.y += Math.abs(deltaYPx);
    if (this.pull.x > SNAP_PULL_BREAK_DISTANCE_PX) this.resetAxis('x', true);
    if (this.pull.y > SNAP_PULL_BREAK_DISTANCE_PX) this.resetAxis('y', true);
  }

  /**
   * Строит snap-линии для целевых элементов в экранных координатах.
   * Каждый элемент даёт 4 линии (каждая сторона bounding rect).
   */
  buildTargetLines(
    elements: {
      screenBBox: { x: number; y: number; width: number; height: number };
    }[],
  ): void {
    this.snapLines = [];
    for (const el of elements) {
      const { x, y, width, height } = el.screenBBox;
      const l = x,
        r = x + width,
        t = y,
        b = y + height;
      this.snapLines.push({ x: l, y: t, x2: r, y2: t }); // top
      this.snapLines.push({ x: l, y: b, x2: r, y2: b }); // bottom
      this.snapLines.push({ x: l, y: t, x2: l, y2: b }); // left
      this.snapLines.push({ x: r, y: t, x2: r, y2: b }); // right
    }
  }

  /**
   * Строит snap-линии для артборда.
   */
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
    this.snapLines.push({ x: l, y: t, x2: r, y2: t }); // top
    this.snapLines.push({ x: l, y: b, x2: r, y2: b }); // bottom
    this.snapLines.push({ x: l, y: t, x2: l, y2: b }); // left
    this.snapLines.push({ x: r, y: t, x2: r, y2: b }); // right
  }

  /**
   * Вычисляет коррекцию.
   * @param movingPoints — массив мировых точек контура перетаскиваемого элемента,
   *        спроецированных в экранные координаты.
   * Принимает что movingPoints уже сдвинуты на rawDelta (без snap).
   */
  computeCorrection(movingPoints: { x: number; y: number }[]): SnapResult {
    let bestCorrX = 0;
    let bestCorrY = 0;
    let bestDistX = Infinity;
    let bestDistY = Infinity;

    for (const pt of movingPoints) {
      for (const line of this.snapLines) {
        // Snap по X: расстояние от точки до линии по Y (горизонтальная линия)
        if (line.y === line.y2) {
          const dist = Math.abs(pt.y - line.y);
          if (dist < SNAP_DISTANCE_PX && dist < bestDistY) {
            const onSegment =
              pt.x >= Math.min(line.x, line.x2) &&
              pt.x <= Math.max(line.x, line.x2);
            if (onSegment || dist < 4) {
              bestDistY = dist;
              bestCorrY = line.y - pt.y;
            }
          }
        }
        // Snap по Y: расстояние от точки до линии по X (вертикальная линия)
        if (line.x === line.x2) {
          const dist = Math.abs(pt.x - line.x);
          if (dist < SNAP_DISTANCE_PX && dist < bestDistX) {
            const onSegment =
              pt.y >= Math.min(line.y, line.y2) &&
              pt.y <= Math.max(line.y, line.y2);
            if (onSegment || dist < 4) {
              bestDistX = dist;
              bestCorrX = line.x - pt.x;
            }
          }
        }
      }
    }

    const wasXSnapped = Boolean(this.active.x);
    const wasYSnapped = Boolean(this.active.y);

    return {
      correctionX: this.resolveAxis('x', bestCorrX, bestDistX, wasYSnapped),
      correctionY: this.resolveAxis('y', bestCorrY, bestDistY, wasXSnapped),
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
    isOtherAxisSnapped: boolean,
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
    const snapDistance = isOtherAxisSnapped ? SNAP_DISTANCE_PX : maxDistance;

    if (distance >= snapDistance) {
      this.resetAxis(axis);
      return 0;
    }

    this.active[axis] = true;
    this.pull[axis] = 0;
    return correction;
  }
}
