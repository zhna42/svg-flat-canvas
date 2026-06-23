import type {
  Point,
  BoundingBox,
  AdvancedHitArea,
  CADElement,
  SnapConfig,
  SnapResult,
  SnapGuideline,
  SnapConstraint,
  BezierSegment,
  EdgeInfo,
} from './snap-types';
import { SnapGeometry } from './SnapGeometry';

function expandBBox(bbox: BoundingBox, r: number): BoundingBox {
  return {
    minX: bbox.minX - r,
    minY: bbox.minY - r,
    maxX: bbox.maxX + r,
    maxY: bbox.maxY + r,
  };
}

function getStrokeOffset(strokeWidth: number, alignment: 'center' | 'inside' | 'outside'): number {
  if (alignment === 'outside') return strokeWidth;
  if (alignment === 'center') return strokeWidth / 2;
  return 0;
}

function computeBounds(points: Point[]): BoundingBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

interface SnapCandidate {
  distSq: number;
  snapX: number;
  snapY: number;
  kind: 'corner' | 'plane';
  planeAx?: number;
  planeAy?: number;
  planeBx?: number;
  planeBy?: number;
}

interface GroupPoint {
  x: number;
  y: number;
}

const NO_CONSTRAINT: SnapConstraint = { type: 'none', snapX: 0, snapY: 0 };
const EMPTY_RESULT: SnapResult = { delta: { x: 0, y: 0 }, constraint: NO_CONSTRAINT, guidelines: [] };

function getGroupPoints(gb: BoundingBox): GroupPoint[] {
  const cx = (gb.minX + gb.maxX) / 2;
  const cy = (gb.minY + gb.maxY) / 2;
  return [
    { x: gb.minX, y: gb.minY },
    { x: cx, y: gb.minY },
    { x: gb.maxX, y: gb.minY },
    { x: gb.maxX, y: cy },
    { x: gb.maxX, y: gb.maxY },
    { x: cx, y: gb.maxY },
    { x: gb.minX, y: gb.maxY },
    { x: gb.minX, y: cy },
    { x: cx, y: cy },
  ];
}

function collectStaticAreas(
  movingElements: CADElement[],
  candidateIds: string[],
  getElementById: (id: string) => CADElement | undefined,
): AdvancedHitArea[] {
  const movingIdSet = new Set<string>();
  for (let i = 0; i < movingElements.length; i++) {
    movingIdSet.add(movingElements[i].id);
  }
  const areas: AdvancedHitArea[] = [];
  for (let i = 0; i < candidateIds.length; i++) {
    if (!movingIdSet.has(candidateIds[i])) {
      const el = getElementById(candidateIds[i]);
      if (el) areas.push(el.getHitArea());
    }
  }
  return areas;
}

export class StaticSnapEngine {
  public static calculate(config: SnapConfig): SnapResult {
    const {
      mode, movingElements, groupBounds, grid, camera,
      currentMouseWorld, accumulatorState,
      screenSnapRadius, screenDetachThreshold,
      axisLock, snapToCorners, snapToPlanes,
      snapToCanvas, canvasBounds, customGuidelines,
    } = config;

    const zoom = camera.zoom > 0.001 ? camera.zoom : 1;
    const rWorld = screenSnapRadius / zoom;
    const tWorld = screenDetachThreshold / zoom;
    const holdWorld = tWorld * 0.3;
    const rWorldSq = rWorld * rWorld;
    const cmx = currentMouseWorld.x;
    const cmy = currentMouseWorld.y;

    const prev = accumulatorState.constraint;

    if (prev.type === 'point') {
      const dx = cmx - prev.snapX;
      const dy = cmy - prev.snapY;
      if (dx * dx + dy * dy <= holdWorld * holdWorld) {
        return {
          delta: { x: prev.snapX - cmx, y: prev.snapY - cmy },
          constraint: { type: 'point', snapX: prev.snapX, snapY: prev.snapY },
          guidelines: [],
        };
      }
    }

    if (prev.type === 'line') {
      const ldx = prev.lineBx! - prev.lineAx!;
      const ldy = prev.lineBy! - prev.lineAy!;
      const llenSq = ldx * ldx + ldy * ldy;
      if (llenSq > 1e-12) {
        const llen = Math.sqrt(llenSq);
        const nx = -ldy / llen;
        const ny = ldx / llen;
        const ddx = cmx - prev.lineAx!;
        const ddy = cmy - prev.lineAy!;
        const nd = ddx * nx + ddy * ny;
        if (Math.abs(nd) <= holdWorld) {
          const tProj = (ddx * ldx + ddy * ldy) / llenSq;
          const px = prev.lineAx! + tProj * ldx;
          const py = prev.lineAy! + tProj * ldy;
          return {
            delta: { x: px - cmx, y: py - cmy },
            constraint: {
              type: 'line', snapX: px, snapY: py,
              lineAx: prev.lineAx, lineAy: prev.lineAy,
              lineBx: prev.lineBx, lineBy: prev.lineBy,
            },
            guidelines: [],
          };
        }
      }
    }

    if (prev.type !== 'none') {
      accumulatorState.constraint = NO_CONSTRAINT;
    }

    if (!snapToCorners && !snapToPlanes) {
      return EMPTY_RESULT;
    }

    const ha = movingElements[0].getHitArea();
    const activePoints: GroupPoint[] = (mode === 'group' && groupBounds)
      ? getGroupPoints(groupBounds)
      : ha.vertices;
    const movingBounds = (mode === 'group' && groupBounds)
      ? groupBounds
      : computeBounds(activePoints);
    const searchBounds = expandBBox(movingBounds, rWorld);
    const candidateIds = grid.query(
      searchBounds.minX,
      searchBounds.minY,
      searchBounds.maxX - searchBounds.minX,
      searchBounds.maxY - searchBounds.minY,
    );
    const staticAreas = collectStaticAreas(movingElements, candidateIds, config.getElementById);

    let bestCorner: SnapCandidate | null = null;
    let bestPlane: SnapCandidate | null = null;

    const APL = activePoints.length;
    const SAL = staticAreas.length;
    const cornerSnapEnabled = snapToCorners;
    const planeSnapEnabled = snapToPlanes;

    for (let pi = 0; pi < APL && pi < 20; pi++) {
      const pt = activePoints[pi];

      if (cornerSnapEnabled) {
        for (let si = 0; si < SAL; si++) {
          const sha = staticAreas[si];
          const verts = sha.vertices;
          for (let vi = 0; vi < verts.length; vi++) {
            const v = verts[vi];
            const dx = v.x - pt.x;
            const dy = v.y - pt.y;
            const dsq = dx * dx + dy * dy;
            if (dsq < rWorldSq && (!bestCorner || dsq < bestCorner.distSq)) {
              bestCorner = { distSq: dsq, snapX: v.x, snapY: v.y, kind: 'corner' };
            }
          }

          if (sha.shapeType === 'circle') {
            const sd = sha.shapeData as { cx: number; cy: number; rx: number; ry: number; r?: number } | undefined;
            if (sd) {
              const cx = sd.cx, cy = sd.cy;
              const r = sd.r ?? sd.rx ?? 0;
              if (r > 0) {
                const strokeOff = getStrokeOffset(sha.strokeWidth, sha.strokeAlignment);
                const quadSnap = SnapGeometry.snapToCircleQuadrants(pt.x, pt.y, cx, cy, r, strokeOff, rWorldSq);
                if (quadSnap && (!bestCorner || quadSnap.distSq < bestCorner.distSq)) {
                  bestCorner = { distSq: quadSnap.distSq, snapX: quadSnap.snapX, snapY: quadSnap.snapY, kind: 'corner' };
                }
              }
            }
          }
        }

        if (snapToCanvas && canvasBounds) {
          const cVerts: GroupPoint[] = [
            { x: canvasBounds.minX, y: canvasBounds.minY },
            { x: canvasBounds.maxX, y: canvasBounds.minY },
            { x: canvasBounds.maxX, y: canvasBounds.maxY },
            { x: canvasBounds.minX, y: canvasBounds.maxY },
          ];
          for (let vi = 0; vi < 4; vi++) {
            const v = cVerts[vi];
            const dx = v.x - pt.x;
            const dy = v.y - pt.y;
            const dsq = dx * dx + dy * dy;
            if (dsq < rWorldSq && (!bestCorner || dsq < bestCorner.distSq)) {
              bestCorner = { distSq: dsq, snapX: v.x, snapY: v.y, kind: 'corner' };
            }
          }
        }
      }

      if (planeSnapEnabled) {
        for (let si = 0; si < SAL; si++) {
          const sha = staticAreas[si];
          const edges = sha.edges;

          for (let ei = 0; ei < edges.length; ei++) {
            const edge = edges[ei];
            const proj = SnapGeometry.pointToSegment(pt.x, pt.y, edge.ax, edge.ay, edge.bx, edge.by);
            if (proj.distSq < rWorldSq && (!bestPlane || proj.distSq < bestPlane.distSq)) {
              bestPlane = {
                distSq: proj.distSq,
                snapX: proj.closestX,
                snapY: proj.closestY,
                kind: 'plane',
                planeAx: edge.ax, planeAy: edge.ay,
                planeBx: edge.bx, planeBy: edge.by,
              };
            }
          }

          if (sha.shapeType === 'ellipse' || sha.shapeType === 'circle') {
            const sd = sha.shapeData as { cx: number; cy: number; rx: number; ry: number; r?: number } | undefined;
            if (sd) {
              const cx = sd.cx, cy = sd.cy;
              const rx = sha.shapeType === 'circle' ? (sd.r ?? sd.rx ?? 0) : sd.rx;
              const ry = sha.shapeType === 'circle' ? (sd.r ?? sd.ry ?? 0) : sd.ry;
              if (rx > 0 && ry > 0) {
                const strokeOff = getStrokeOffset(sha.strokeWidth, sha.strokeAlignment);
                const edge = SnapGeometry.snapToEllipseTangential(pt.x, pt.y, cx, cy, rx, ry, strokeOff);
                if (edge && edge.distSq < rWorldSq && (!bestPlane || edge.distSq < bestPlane.distSq)) {
                  const ex = edge.snapX - cx;
                  const ey = edge.snapY - cy;
                  const eLen = Math.sqrt(ex * ex + ey * ey) || 1;
                  const tx = -ey / eLen;
                  const ty = ex / eLen;
                  bestPlane = {
                    distSq: edge.distSq,
                    snapX: edge.snapX,
                    snapY: edge.snapY,
                    kind: 'plane',
                    planeAx: edge.snapX + tx * 1e8,
                    planeAy: edge.snapY + ty * 1e8,
                    planeBx: edge.snapX - tx * 1e8,
                    planeBy: edge.snapY - ty * 1e8,
                  };
                }
              }
            }
          }

          if (sha.shapeType === 'bezier') {
            const segments = sha.shapeData as BezierSegment[] | undefined;
            if (segments) {
              for (let bi = 0; bi < segments.length; bi++) {
                const proj = SnapGeometry.projectToBezier(pt.x, pt.y, segments[bi]);
                if (proj.distSq < rWorldSq && (!bestPlane || proj.distSq < bestPlane.distSq)) {
                  bestPlane = {
                    distSq: proj.distSq,
                    snapX: proj.point.x,
                    snapY: proj.point.y,
                    kind: 'plane',
                  };
                }
              }
            }
          }
        }

        if (snapToCanvas && canvasBounds) {
          const canvasEdges: EdgeInfo[] = [
            { ax: canvasBounds.minX, ay: canvasBounds.minY, bx: canvasBounds.maxX, by: canvasBounds.minY },
            { ax: canvasBounds.maxX, ay: canvasBounds.minY, bx: canvasBounds.maxX, by: canvasBounds.maxY },
            { ax: canvasBounds.maxX, ay: canvasBounds.maxY, bx: canvasBounds.minX, by: canvasBounds.maxY },
            { ax: canvasBounds.minX, ay: canvasBounds.maxY, bx: canvasBounds.minX, by: canvasBounds.minY },
          ];
          for (let ei = 0; ei < 4; ei++) {
            const proj = SnapGeometry.pointToSegment(pt.x, pt.y, canvasEdges[ei].ax, canvasEdges[ei].ay, canvasEdges[ei].bx, canvasEdges[ei].by);
            if (proj.distSq < rWorldSq && (!bestPlane || proj.distSq < bestPlane.distSq)) {
              bestPlane = {
                distSq: proj.distSq,
                snapX: proj.closestX,
                snapY: proj.closestY,
                kind: 'plane',
                planeAx: canvasEdges[ei].ax, planeAy: canvasEdges[ei].ay,
                planeBx: canvasEdges[ei].bx, planeBy: canvasEdges[ei].by,
              };
            }
          }
        }

        const guidelineHits: SnapGuideline[] = [];
        for (let gi = 0; gi < customGuidelines.length; gi++) {
          const gl = customGuidelines[gi];
          if (gl.type === 'horizontal') {
            const dy = gl.value - pt.y;
            const dsq = dy * dy;
            if (dsq < rWorldSq && (!bestPlane || dsq < bestPlane.distSq)) {
              bestPlane = {
                distSq: dsq, snapX: pt.x, snapY: gl.value,
                kind: 'plane',
                planeAx: -1e8, planeAy: gl.value,
                planeBx: 1e8, planeBy: gl.value,
              };
              guidelineHits.push({ type: 'horizontal', value: gl.value, from: { x: -1e8, y: gl.value }, to: { x: 1e8, y: gl.value } });
            }
          } else {
            const dx = gl.value - pt.x;
            const dsq = dx * dx;
            if (dsq < rWorldSq && (!bestPlane || dsq < bestPlane.distSq)) {
              bestPlane = {
                distSq: dsq, snapX: gl.value, snapY: pt.y,
                kind: 'plane',
                planeAx: gl.value, planeAy: -1e8,
                planeBx: gl.value, planeBy: 1e8,
              };
              guidelineHits.push({ type: 'vertical', value: gl.value, from: { x: gl.value, y: -1e8 }, to: { x: gl.value, y: 1e8 } });
            }
          }
        }
      }
    }

    const winner = (bestCorner !== null && bestPlane !== null)
      ? (bestCorner.distSq <= bestPlane.distSq ? bestCorner : bestPlane)
      : (bestCorner ?? bestPlane);

    if (winner === null) {
      accumulatorState.constraint = NO_CONSTRAINT;
      return EMPTY_RESULT;
    }

    let constraint: SnapConstraint;
    let dx: number;
    let dy: number;

    if (winner.kind === 'corner') {
      constraint = { type: 'point', snapX: winner.snapX, snapY: winner.snapY };
      dx = winner.snapX - cmx;
      dy = winner.snapY - cmy;
      if (axisLock.lockX) dx = 0;
      if (axisLock.lockY) dy = 0;
    } else {
      dx = winner.snapX - cmx;
      dy = winner.snapY - cmy;

      const pax = winner.planeAx!;
      const pay = winner.planeAy!;
      const pbx = winner.planeBx!;
      const pby = winner.planeBy!;

      if (pax !== undefined) {
        constraint = {
          type: 'line',
          snapX: winner.snapX,
          snapY: winner.snapY,
          lineAx: pax,
          lineAy: pay,
          lineBx: pbx,
          lineBy: pby,
        };

        const ldx = pbx - pax;
        const ldy = pby - pay;
        const llen = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
        const alongX = ldx / llen;
        const alongY = ldy / llen;
        const tProj = dx * alongX + dy * alongY;

        if (axisLock.lockX && !axisLock.lockY) {
          const normalY = dy - tProj * alongY;
          dx = 0;
          dy = normalY;
        } else if (axisLock.lockY && !axisLock.lockX) {
          const normalX = dx - tProj * alongX;
          dx = normalX;
          dy = 0;
        } else {
          const normalX = dx - tProj * alongX;
          const normalY = dy - tProj * alongY;
          dx = normalX;
          dy = normalY;
        }
      } else {
        constraint = { type: 'point', snapX: winner.snapX, snapY: winner.snapY };
        if (axisLock.lockX) dx = 0;
        if (axisLock.lockY) dy = 0;
      }
    }

    accumulatorState.constraint = constraint;

    return {
      delta: { x: dx, y: dy },
      constraint,
      guidelines: [],
    };
  }
}
