import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/camera/Camera';
import type { Point } from '@/types';
import type { SpatialGrid } from '@/spatial/SpatialGrid';
import {
  type CurveTarget,
  type ScreenBezierSeg,
} from '@/snap/AdaptiveSnapEngine';
import { CircleElement } from '@/shapes/elements/CircleElement';
import { EllipseElement } from '@/shapes/elements/EllipseElement';
import { PathElement } from '@/shapes/elements/PathElement';
import { flattenCommands } from '@/spatial/path-utils';
import {
  offsetPolygon,
  offsetOpenPath,
  approximateArc,
} from '@/spatial/geometry-utils';
import { polyIntersectsPoly, segmentIntersectsSegment } from '@/spatial/hit-test';

export function generateCirclePoints(
  cx: number,
  cy: number,
  r: number,
  count: number,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

export function getCenterlinePoints(
  el: AbstractGraphicElement,
  camera: Camera,
  local = false,
): Point[] | null {
  const toWorld = (pts: Point[]) =>
    local ? pts : pts.map((p) => el.transformPoint(p));

  if (el instanceof CircleElement) {
    const count = Math.max(16, Math.round(16 * camera.zoom));
    const localPts = generateCirclePoints(
      el.geometry.cx,
      el.geometry.cy,
      el.geometry.r,
      count,
    );
    return toWorld(localPts);
  }

  if (el instanceof PathElement) {
    const steps = Math.max(12, Math.round(12 * camera.zoom));
    const cmds = el.geometry.commands;
    if (cmds.length === 0) return [];
    return toWorld(flattenCommands(cmds, steps));
  }

  if (el.type === 'rect') {
    const g = (el as any).geometry as {
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
      ry: number;
    };
    if (g.rx || g.ry) {
      const quadrants = 16;
      const rx = Math.min(g.rx || g.ry, g.width / 2);
      const ry = Math.min(g.ry || g.rx, g.height / 2);
      const arcPts = approximateArc(rx, ry, quadrants);
      const cx = g.x + g.width / 2,
        cy = g.y + g.height / 2;
      const iw = g.width / 2 - rx,
        ih = g.height / 2 - ry;
      const result: Point[] = [];
      for (let i = 0; i < quadrants; i++)
        result.push({ x: cx + arcPts[i].x + iw, y: cy + arcPts[i].y + ih });
      for (let i = 0; i < quadrants; i++)
        result.push({
          x: cx - arcPts[quadrants - 1 - i].x - iw,
          y: cy + arcPts[quadrants - 1 - i].y + ih,
        });
      for (let i = 0; i < quadrants; i++)
        result.push({ x: cx - arcPts[i].x - iw, y: cy - arcPts[i].y - ih });
      for (let i = 0; i < quadrants; i++)
        result.push({
          x: cx + arcPts[quadrants - 1 - i].x + iw,
          y: cy - arcPts[quadrants - 1 - i].y - ih,
        });
      return toWorld(result);
    }
    const localPts: Point[] = [
      { x: g.x, y: g.y },
      { x: g.x + g.width, y: g.y },
      { x: g.x + g.width, y: g.y + g.height },
      { x: g.x, y: g.y + g.height },
    ];
    return toWorld(localPts);
  }

  if (el.type === 'line') {
    const g = (el as any).geometry as {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };
    const localPts: Point[] = [
      { x: g.x1, y: g.y1 },
      { x: g.x2, y: g.y2 },
    ];
    return toWorld(localPts);
  }

  if (el.type === 'polygon' || el.type === 'polyline') {
    const raw = (el as any).points as string;
    const nums = raw
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    const pts: Point[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2)
      pts.push({ x: nums[i], y: nums[i + 1] });
    return toWorld(pts);
  }

  el.buildHitArea();
  const pts = el.hitArea;
  if (pts.length === 0) return [];
  return toWorld(pts);
}

export function offsetScreenPoints(
  screenPts: { x: number; y: number }[],
  strokeOffsetPx: number,
  hasFill: boolean,
  isClosed: boolean,
): { x: number; y: number }[] {
  if (strokeOffsetPx <= 0) return screenPts;
  if (hasFill) {
    const cx = screenPts.reduce((s, p) => s + p.x, 0) / screenPts.length;
    const cy = screenPts.reduce((s, p) => s + p.y, 0) / screenPts.length;
    return screenPts.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy);
      if (len === 0) return { ...p };
      return {
        x: p.x + (dx / len) * strokeOffsetPx,
        y: p.y + (dy / len) * strokeOffsetPx,
      };
    });
  }
  if (isClosed) return offsetPolygon(screenPts, strokeOffsetPx);
  return offsetOpenPath(screenPts, strokeOffsetPx);
}

export function getVisualWorldPoints(
  el: AbstractGraphicElement,
  camera: Camera,
  m?: DOMMatrix,
): Point[] {
  if (el instanceof CircleElement) {
    const r = el.geometry.r + el.style.strokeWidth / 2;
    const count = Math.max(24, Math.round(24 * camera.zoom));
    const localPts = generateCirclePoints(
      el.geometry.cx,
      el.geometry.cy,
      r,
      count,
    );
    if (m) return localPts.map((p) => m.transformPoint(p));
    return localPts.map((p) => el.transformPoint(p));
  }

  const localPts = getCenterlinePoints(el, camera, true);
  if (!localPts || localPts.length === 0) return [];

  const halfSw = el.style.strokeWidth / 2;
  let result: Point[];
  if (m) result = localPts.map((p) => m.transformPoint(p));
  else result = localPts.map((p) => el.transformPoint(p));

  if (halfSw > 0 && result.length >= 2) {
    const cx = result.reduce((s, p) => s + p.x, 0) / result.length;
    const cy = result.reduce((s, p) => s + p.y, 0) / result.length;
    result = result.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy);
      if (len === 0) return p;
      return { x: p.x + (dx / len) * halfSw, y: p.y + (dy / len) * halfSw };
    });
  }
  return result;
}

export function getScreenCurveTargets(
  elements: AbstractGraphicElement[],
  camera: Camera,
): CurveTarget[] {
  const targets: CurveTarget[] = [];
  for (const el of elements) {
    const halfSw = el.style.strokeWidth / 2;
    if (el instanceof CircleElement) {
      const geo = el.geometry;
      const visualR = geo.r + halfSw;
      const worldCenter = el.transformPoint({ x: geo.cx, y: geo.cy });
      const worldEdge = el.transformPoint({ x: geo.cx + visualR, y: geo.cy });
      const sc = camera.worldToScreen(worldCenter);
      const se = camera.worldToScreen(worldEdge);
      const screenR = Math.hypot(se.x - sc.x, se.y - sc.y);
      if (screenR > 0) {
        targets.push({
          type: 'circle',
          cx: sc.x,
          cy: sc.y,
          rx: screenR,
          ry: screenR,
        });
      }
    } else if (el instanceof EllipseElement) {
      const geo = el.geometry;
      const visualRx = geo.rx + halfSw;
      const visualRy = geo.ry + halfSw;
      const worldCenter = el.transformPoint({ x: geo.cx, y: geo.cy });
      const worldRX = el.transformPoint({ x: geo.cx + visualRx, y: geo.cy });
      const worldRY = el.transformPoint({ x: geo.cx, y: geo.cy + visualRy });
      const sc = camera.worldToScreen(worldCenter);
      const sx = camera.worldToScreen(worldRX);
      const sy = camera.worldToScreen(worldRY);
      const screenRx = Math.hypot(sx.x - sc.x, sx.y - sc.y);
      const screenRy = Math.hypot(sy.x - sc.x, sy.y - sc.y);
      if (screenRx > 0 && screenRy > 0) {
        targets.push({
          type: 'ellipse',
          cx: sc.x,
          cy: sc.y,
          rx: screenRx,
          ry: screenRy,
        });
      }
    }
  }
  return targets;
}

export function extractBezierTargets(
  elements: AbstractGraphicElement[],
  camera: Camera,
): CurveTarget[] {
  const targets: CurveTarget[] = [];
  for (const el of elements) {
    if (!(el instanceof PathElement)) continue;
    const cmds = el.geometry.commands;
    if (cmds.length === 0) continue;
    const segs: ScreenBezierSeg[] = [];
    let curX = 0;
    let curY = 0;
    let subStartX = 0;
    let subStartY = 0;
    let prevCmd = '';
    for (const cmd of cmds) {
      const c = cmd.command;
      const a = cmd.args;
      const isRel = c === c.toLowerCase();
      if (c === 'M' || c === 'm') {
        curX = isRel ? curX + a[0] : a[0];
        curY = isRel ? curY + a[1] : a[1];
        subStartX = curX;
        subStartY = curY;
      } else if (c === 'L' || c === 'l' || c === 'T' || c === 't') {
        curX = isRel ? curX + (a[a.length - 2] ?? 0) : a[a.length - 2];
        curY = isRel ? curY + (a[a.length - 1] ?? 0) : a[a.length - 1];
      } else if (c === 'C' || c === 'c') {
        const p0x = curX;
        const p0y = curY;
        const p1x = isRel ? curX + a[0] : a[0];
        const p1y = isRel ? curY + a[1] : a[1];
        const p2x = isRel ? curX + a[2] : a[2];
        const p2y = isRel ? curY + a[3] : a[3];
        const p3x = isRel ? curX + a[4] : a[4];
        const p3y = isRel ? curY + a[5] : a[5];
        const wp0 = el.transformPoint({ x: p0x, y: p0y });
        const wp1 = el.transformPoint({ x: p1x, y: p1y });
        const wp2 = el.transformPoint({ x: p2x, y: p2y });
        const wp3 = el.transformPoint({ x: p3x, y: p3y });
        const sp0 = camera.worldToScreen(wp0);
        const sp1 = camera.worldToScreen(wp1);
        const sp2 = camera.worldToScreen(wp2);
        const sp3 = camera.worldToScreen(wp3);
        segs.push({
          p0x: sp0.x,
          p0y: sp0.y,
          p1x: sp1.x,
          p1y: sp1.y,
          p2x: sp2.x,
          p2y: sp2.y,
          p3x: sp3.x,
          p3y: sp3.y,
          type: 'cubic',
        });
        curX = p3x;
        curY = p3y;
      } else if (c === 'Q' || c === 'q') {
        const p0x = curX;
        const p0y = curY;
        const p1x = isRel ? curX + a[0] : a[0];
        const p1y = isRel ? curY + a[1] : a[1];
        const p2x = isRel ? curX + a[2] : a[2];
        const p2y = isRel ? curY + a[3] : a[3];
        const wp0 = el.transformPoint({ x: p0x, y: p0y });
        const wp1 = el.transformPoint({ x: p1x, y: p1y });
        const wp2 = el.transformPoint({ x: p2x, y: p2y });
        const sp0 = camera.worldToScreen(wp0);
        const sp1 = camera.worldToScreen(wp1);
        const sp2 = camera.worldToScreen(wp2);
        segs.push({
          p0x: sp0.x,
          p0y: sp0.y,
          p1x: sp1.x,
          p1y: sp1.y,
          p2x: sp2.x,
          p2y: sp2.y,
          type: 'quadratic',
        });
        curX = p2x;
        curY = p2y;
      } else if (c === 'Z' || c === 'z') {
        curX = subStartX;
        curY = subStartY;
      } else if (c === 'H' || c === 'h') {
        curX = isRel ? curX + a[0] : a[0];
      } else if (c === 'V' || c === 'v') {
        curY = isRel ? curY + a[0] : a[0];
      } else if (c === 'S' || c === 's') {
        const p0x = curX;
        const p0y = curY;
        let p1x: number;
        let p1y: number;
        if (
          prevCmd === 'C' ||
          prevCmd === 'c' ||
          prevCmd === 'S' ||
          prevCmd === 's'
        ) {
          const lastCmd = cmds[cmds.indexOf(cmd) - 1];
          const la = lastCmd.args;
          const lastRel = lastCmd.command === lastCmd.command.toLowerCase();
          p1x = lastRel ? curX + la[la.length - 4] : la[la.length - 4];
          p1y = lastRel ? curY + la[la.length - 3] : la[la.length - 3];
        } else {
          p1x = p0x;
          p1y = p0y;
        }
        const p2x = isRel ? curX + a[0] : a[0];
        const p2y = isRel ? curY + a[1] : a[1];
        const p3x = isRel ? curX + a[2] : a[2];
        const p3y = isRel ? curY + a[3] : a[3];
        const wp0 = el.transformPoint({ x: p0x, y: p0y });
        const wp1 = el.transformPoint({ x: p1x, y: p1y });
        const wp2 = el.transformPoint({ x: p2x, y: p2y });
        const wp3 = el.transformPoint({ x: p3x, y: p3y });
        const sp0 = camera.worldToScreen(wp0);
        const sp1 = camera.worldToScreen(wp1);
        const sp2 = camera.worldToScreen(wp2);
        const sp3 = camera.worldToScreen(wp3);
        segs.push({
          p0x: sp0.x,
          p0y: sp0.y,
          p1x: sp1.x,
          p1y: sp1.y,
          p2x: sp2.x,
          p2y: sp2.y,
          p3x: sp3.x,
          p3y: sp3.y,
          type: 'cubic',
        });
        curX = p3x;
        curY = p3y;
      }
      prevCmd = c;
    }
    if (segs.length > 0) {
      targets.push({
        type: 'bezier',
        cx: 0,
        cy: 0,
        rx: 0,
        ry: 0,
        bezierSegs: segs,
      });
    }
  }
  return targets;
}

export function getMovingBBox(worldPts: Point[]): {
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

export function pointToSegmentDist(
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

export function checkSceneCollisions(
  targets: AbstractGraphicElement[],
  startMatrices: Map<string, DOMMatrix>,
  dx: number,
  dy: number,
  camera: Camera,
  grid: SpatialGrid,
  getElements: () => AbstractGraphicElement[],
): Point | null {
  const allElements = getElements();
  const targetIdSet = new Set(targets.map((e) => e.id));
  const targetElements = allElements.filter((el) => !targetIdSet.has(el.id));

  for (const movingEl of targets) {
    const startMat = startMatrices.get(movingEl.id);
    if (!startMat) continue;

    const virtualMatrix = new DOMMatrix(startMat.toString());
    virtualMatrix.e += dx;
    virtualMatrix.f += dy;

    const movingPts = getVisualWorldPoints(
      movingEl,
      camera,
      virtualMatrix,
    );
    if (movingPts.length === 0) continue;

    const movingBBox = getMovingBBox(movingPts);
    const candidateIds = grid.query(
      movingBBox.x,
      movingBBox.y,
      movingBBox.width,
      movingBBox.height,
    );
    const candidates = targetElements.filter((el) =>
      candidateIds.includes(el.id),
    );

    for (const candidate of candidates) {
      const candidatePts = getVisualWorldPoints(candidate, camera);
      if (candidatePts.length === 0) continue;

      const isClosed =
        candidate.type !== 'polyline' &&
        candidate.type !== 'line' &&
        !(
          candidate instanceof PathElement &&
          candidate.geometry.commands.length > 0 &&
          !(
            candidate.geometry.commands[
              candidate.geometry.commands.length - 1
            ].command === 'Z' ||
            candidate.geometry.commands[
              candidate.geometry.commands.length - 1
            ].command === 'z'
          )
        );

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
