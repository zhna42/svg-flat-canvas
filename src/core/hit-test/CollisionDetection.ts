import type { Point } from '@/core/type';
import type { HitTestableElement, CollisionResult } from './types';
import { SpatialStore } from './SpatialStore';
import { polyIntersectsPoly, segmentIntersectsSegment } from './PreciseHitTest';

export interface CollisionContext {
  grid: SpatialStore;
  getElements: () => HitTestableElement[];
  getVisualWorldPoints: (el: HitTestableElement) => Point[];
  isClosedShape: (el: HitTestableElement) => boolean;
}

function pointToSegmentDist(
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

function getMovingBBox(worldPts: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of worldPts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function checkSceneCollisions(
  targets: HitTestableElement[],
  startMatrices: Map<string, DOMMatrix>,
  dx: number,
  dy: number,
  ctx: CollisionContext,
): CollisionResult | null {
  const allElements = ctx.getElements();
  const targetIdSet = new Set(targets.map((e) => e.id));
  const targetElements = allElements.filter((el) => !targetIdSet.has(el.id));

  for (const movingEl of targets) {
    const startMat = startMatrices.get(movingEl.id);
    if (!startMat) continue;

    const virtualMatrix = new DOMMatrix(startMat.toString());
    virtualMatrix.e += dx;
    virtualMatrix.f += dy;

    const movingPts = ctx.getVisualWorldPoints(movingEl);
    if (movingPts.length === 0) continue;

    const movingBBox = getMovingBBox(movingPts);
    const candidateIds = ctx.grid.query(
      movingBBox.x,
      movingBBox.y,
      movingBBox.width,
      movingBBox.height,
    );
    const candidates = targetElements.filter((el) =>
      candidateIds.includes(el.id),
    );

    for (const candidate of candidates) {
      const candidatePts = ctx.getVisualWorldPoints(candidate);
      if (candidatePts.length === 0) continue;

      const isClosed = ctx.isClosedShape(candidate);

      let collision = false;

      if (isClosed) {
        collision = polyIntersectsPoly(movingPts, candidatePts);
      } else {
        const movingN = movingPts.length;
        const candidateN = candidatePts.length;
        for (let mi = 0; mi < movingN && !collision; mi++) {
          const ma = movingPts[mi];
          const mb = movingPts[(mi + 1) % movingN];
          for (let ci = 0; ci < candidateN - 1 && !collision; ci++) {
            if (
              segmentIntersectsSegment(
                ma,
                mb,
                candidatePts[ci],
                candidatePts[ci + 1],
              )
            ) {
              collision = true;
            }
          }
        }
      }

      if (!collision) continue;

      let bestDist = Infinity;
      let bestNx = 0;
      let bestNy = 0;

      for (const mp of movingPts) {
        const n = candidatePts.length;
        const edgeCount = isClosed ? n : n - 1;
        for (let i = 0; i < edgeCount; i++) {
          const j = isClosed ? (i + 1) % n : i + 1;
          const { dist, closestX, closestY } = pointToSegmentDist(
            mp.x,
            mp.y,
            candidatePts[i].x,
            candidatePts[i].y,
            candidatePts[j].x,
            candidatePts[j].y,
          );

          if (dist < bestDist) {
            bestDist = dist;
            const nx = mp.x - closestX;
            const ny = mp.y - closestY;
            const len = Math.hypot(nx, ny);
            if (len > 0) {
              bestNx = nx / len;
              bestNy = ny / len;
            } else {
              bestNx = 0;
              bestNy = -1;
            }
          }
        }
      }

      if (bestDist < Infinity) {
        return { x: bestNx, y: bestNy };
      }
    }
  }
  return null;
}
