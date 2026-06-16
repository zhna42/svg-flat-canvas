import type { SnapResult, SnapOptions } from './snap-types';

type SnapAxis = 'x' | 'y';

type SnapCandidate = {
  distance: number;
  correctionPx: number;
  sideDistance: number;
};

const SNAP_DISTANCE_PX = 16;
const SNAP_RELEASE_DISTANCE_PX = SNAP_DISTANCE_PX * 2;
const CORNER_SNAP_DISTANCE_PX = 6;
const SNAP_PULL_BREAK_DISTANCE_PX = 24;

export class SvgSnap {
  private active: Partial<Record<SnapAxis, boolean>> = {};
  private blocked: Partial<Record<SnapAxis, boolean>> = {};
  private pull: Record<SnapAxis, number> = { x: 0, y: 0 };

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
  }

  updatePull(deltaXPx: number, deltaYPx: number): void {
    if (this.active.x) this.pull.x += Math.abs(deltaXPx);
    if (this.active.y) this.pull.y += Math.abs(deltaYPx);

    if (this.pull.x > SNAP_PULL_BREAK_DISTANCE_PX) this.resetAxis('x', true);
    if (this.pull.y > SNAP_PULL_BREAK_DISTANCE_PX) this.resetAxis('y', true);
  }

  computeCorrection(movingRect: DOMRect, options: SnapOptions): SnapResult {
    const movingXEdges = [movingRect.left, movingRect.right];
    const movingYEdges = [movingRect.top, movingRect.bottom];

    let bestX: SnapCandidate | null = null;
    let bestY: SnapCandidate | null = null;

    for (const r of options.targetRects ?? []) {
      const ySideGap = SvgSnap.rangeGap(
        movingRect.top,
        movingRect.bottom,
        r.top,
        r.bottom,
      );
      const xSideGap = SvgSnap.rangeGap(
        movingRect.left,
        movingRect.right,
        r.left,
        r.right,
      );

      const xCandidate = SvgSnap.bestCandidate(movingXEdges, [r.left, r.right], ySideGap);
      const yCandidate = SvgSnap.bestCandidate(movingYEdges, [r.top, r.bottom], xSideGap);

      if (
        xCandidate &&
        xCandidate.sideDistance <= SNAP_RELEASE_DISTANCE_PX &&
        SvgSnap.isBetter(xCandidate, bestX)
      ) {
        bestX = xCandidate;
      }

      if (
        yCandidate &&
        yCandidate.sideDistance <= SNAP_RELEASE_DISTANCE_PX &&
        SvgSnap.isBetter(yCandidate, bestY)
      ) {
        bestY = yCandidate;
      }
    }

    if (options.listRect) {
      const r = options.listRect;

      const xCandidate = SvgSnap.bestCandidate(movingXEdges, [r.left, r.right], 0);
      const yCandidate = SvgSnap.bestCandidate(movingYEdges, [r.top, r.bottom], 0);

      if (xCandidate && SvgSnap.isBetter(xCandidate, bestX)) bestX = xCandidate;
      if (yCandidate && SvgSnap.isBetter(yCandidate, bestY)) bestY = yCandidate;
    }

    const wasXSnapped = Boolean(this.active.x);
    const wasYSnapped = Boolean(this.active.y);

    return {
      correctionX: this.resolveAxis('x', bestX, wasYSnapped),
      correctionY: this.resolveAxis('y', bestY, wasXSnapped),
    };
  }

  private resetAxis(axis: SnapAxis, block = false): void {
    this.active[axis] = false;
    this.pull[axis] = 0;
    if (block) this.blocked[axis] = true;
  }

  private resolveAxis(
    axis: SnapAxis,
    candidate: SnapCandidate | null,
    isOtherAxisSnapped: boolean,
  ): number {
    if (!candidate) {
      this.resetAxis(axis);
      return 0;
    }

    if (this.blocked[axis]) {
      if (candidate.distance > SNAP_RELEASE_DISTANCE_PX) {
        this.blocked[axis] = false;
      }
      return 0;
    }

    const maxDistance = this.active[axis]
      ? SNAP_RELEASE_DISTANCE_PX
      : SNAP_DISTANCE_PX;
    const snapDistance = isOtherAxisSnapped
      ? CORNER_SNAP_DISTANCE_PX
      : maxDistance;

    if (
      candidate.distance > snapDistance ||
      candidate.sideDistance > SNAP_RELEASE_DISTANCE_PX
    ) {
      this.resetAxis(axis);
      return 0;
    }

    if (!this.active[axis] && candidate.sideDistance > SNAP_DISTANCE_PX) {
      return 0;
    }

    this.active[axis] = true;
    this.pull[axis] = 0;

    return candidate.correctionPx;
  }

  private static rangeGap(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ): number {
    if (aEnd < bStart) return bStart - aEnd;
    if (bEnd < aStart) return aStart - bEnd;
    return 0;
  }

  private static bestCandidate(
    movingEdges: number[],
    targetEdges: number[],
    sideDistance: number,
  ): SnapCandidate | null {
    let best: SnapCandidate | null = null;

    for (const mEdge of movingEdges) {
      for (const tEdge of targetEdges) {
        const correctionPx = tEdge - mEdge;
        const distance = Math.abs(correctionPx);

        if (!best || distance < best.distance) {
          best = { distance, correctionPx, sideDistance };
        }
      }
    }

    return best;
  }

  private static isBetter(a: SnapCandidate, b: SnapCandidate | null): boolean {
    return !b || a.distance + a.sideDistance < b.distance + b.sideDistance;
  }
}
