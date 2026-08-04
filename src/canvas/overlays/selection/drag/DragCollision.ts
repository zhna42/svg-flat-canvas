import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/canvas/Camera';
import type { Point } from '@/core/type';
import type { CurveTarget, ScreenBezierSeg } from '@/core/type';
import { CircleElement } from '@/core/shapes/elements/CircleElement';
import { EllipseElement } from '@/core/shapes/elements/EllipseElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import { segmentsToCommands } from '@/core/type';
import { flattenCommands } from '@/core/math/path';
import {
  approximateArc,
  offsetOpenPath,
  offsetPolygon,
} from '@/core/math/geometry';

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

function decimateByThreshold(pts: Point[]): Point[] {
  let step = 1;
  const n = pts.length;
  if (n > 800) step = 10;
  else if (n > 500) step = 6;
  else if (n > 300) step = 3;
  else if (n > 100) step = 2;
  if (step === 1) return pts;

  const decimated: Point[] = [];
  for (let i = 0; i < pts.length; i += step) decimated.push(pts[i]);
  if (decimated[decimated.length - 1] !== pts[pts.length - 1]) {
    decimated.push(pts[pts.length - 1]);
  }
  return decimated;
}

export function getCenterlinePoints(
  el: AbstractGraphicElement,
  camera: Camera,
  local = false,
): Point[] | null {
  const toWorld = (pts: Point[]) =>
    local ? pts : pts.map((p) => el.transform.transformPoint(p));

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
    const segs = el.geometry.segments;
    if (segs.length === 0) return [];
    const steps = Math.max(12, Math.round(12 * camera.zoom));
    const cmds = segmentsToCommands(segs);
    let pts = flattenCommands(cmds, steps);
    pts = decimateByThreshold(pts);
    return toWorld(pts);
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
    return localPts.map((p) => el.transform.transformPoint(p));
  }

  const localPts = getCenterlinePoints(el, camera, true);
  if (!localPts || localPts.length === 0) return [];

  const halfSw = el.style.strokeWidth / 2;
  let result: Point[];
  if (m) result = localPts.map((p) => m.transformPoint(p));
  else result = localPts.map((p) => el.transform.transformPoint(p));

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
      const worldCenter = el.transform.transformPoint({ x: geo.cx, y: geo.cy });
      const worldEdge = el.transform.transformPoint({
        x: geo.cx + visualR,
        y: geo.cy,
      });
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
      const worldCenter = el.transform.transformPoint({ x: geo.cx, y: geo.cy });
      const worldRX = el.transform.transformPoint({
        x: geo.cx + visualRx,
        y: geo.cy,
      });
      const worldRY = el.transform.transformPoint({
        x: geo.cx,
        y: geo.cy + visualRy,
      });
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
    const cmds = segmentsToCommands(el.geometry.segments);
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
        const wp0 = el.transform.transformPoint({ x: p0x, y: p0y });
        const wp1 = el.transform.transformPoint({ x: p1x, y: p1y });
        const wp2 = el.transform.transformPoint({ x: p2x, y: p2y });
        const wp3 = el.transform.transformPoint({ x: p3x, y: p3y });
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
        const wp0 = el.transform.transformPoint({ x: p0x, y: p0y });
        const wp1 = el.transform.transformPoint({ x: p1x, y: p1y });
        const wp2 = el.transform.transformPoint({ x: p2x, y: p2y });
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
        const wp0 = el.transform.transformPoint({ x: p0x, y: p0y });
        const wp1 = el.transform.transformPoint({ x: p1x, y: p1y });
        const wp2 = el.transform.transformPoint({ x: p2x, y: p2y });
        const wp3 = el.transform.transformPoint({ x: p3x, y: p3y });
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
