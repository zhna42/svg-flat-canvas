import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { CommandBus } from '@/commands/CommandBus';
import type { Camera } from '@/camera/Camera';
import type { Point } from '@/types';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { SvgSnap } from '@/snap/SvgSnap';
import { createDragEndCommand } from '@/commands/factories/drag-command-factory';
import { CircleElement } from '@/shapes/elements/CircleElement';
import { PathElement } from '@/shapes/elements/PathElement';
import { flattenCommands } from '@/utils/path-utils';
import { offsetPolygon, offsetOpenPath, approximateArc } from '@/utils/geometry-utils';
import { polyIntersectsPoly } from '@/utils/hit-test';

function generateCirclePoints(cx: number, cy: number, r: number, count: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function getCenterlinePoints(el: AbstractGraphicElement, camera: Camera, local = false): Point[] | null {
  const toWorld = (pts: Point[]) => local ? pts : pts.map((p) => el.transformPoint(p));

  if (el instanceof CircleElement) {
    const count = Math.max(16, Math.round(16 * camera.zoom));
    const localPts = generateCirclePoints(el.geometry.cx, el.geometry.cy, el.geometry.r, count);
    return toWorld(localPts);
  }

  if (el instanceof PathElement) {
    const steps = Math.max(12, Math.round(12 * camera.zoom));
    const cmds = el.parsedD.commands;
    if (cmds.length === 0) return [];
    return toWorld(flattenCommands(cmds, steps));
  }

  if (el.type === 'rect') {
    const g = (el as any).geometry as { x: number; y: number; width: number; height: number; rx: number; ry: number };
    if (g.rx || g.ry) {
      const quadrants = 16;
      const rx = Math.min(g.rx || g.ry, g.width / 2);
      const ry = Math.min(g.ry || g.rx, g.height / 2);
      const arcPts = approximateArc(rx, ry, quadrants);
      const cx = g.x + g.width / 2, cy = g.y + g.height / 2;
      const iw = g.width / 2 - rx, ih = g.height / 2 - ry;
      const result: Point[] = [];
      for (let i = 0; i < quadrants; i++) result.push({ x: cx + arcPts[i].x + iw, y: cy + arcPts[i].y + ih });
      for (let i = 0; i < quadrants; i++) result.push({ x: cx - arcPts[quadrants - 1 - i].x - iw, y: cy + arcPts[quadrants - 1 - i].y + ih });
      for (let i = 0; i < quadrants; i++) result.push({ x: cx - arcPts[i].x - iw, y: cy - arcPts[i].y - ih });
      for (let i = 0; i < quadrants; i++) result.push({ x: cx + arcPts[quadrants - 1 - i].x + iw, y: cy - arcPts[quadrants - 1 - i].y - ih });
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
    const g = (el as any).geometry as { x1: number; y1: number; x2: number; y2: number };
    const localPts: Point[] = [
      { x: g.x1, y: g.y1 },
      { x: g.x2, y: g.y2 },
    ];
    return toWorld(localPts);
  }

  if (el.type === 'polygon' || el.type === 'polyline') {
    const raw = (el as any).points as string;
    const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    const pts: Point[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
    return toWorld(pts);
  }

  el.buildHitArea();
  const pts = el.hitArea;
  if (pts.length === 0) return [];
  return toWorld(pts);
}

function offsetScreenPoints(
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
      return { x: p.x + (dx / len) * strokeOffsetPx, y: p.y + (dy / len) * strokeOffsetPx };
    });
  }
  if (isClosed) return offsetPolygon(screenPts, strokeOffsetPx);
  return offsetOpenPath(screenPts, strokeOffsetPx);
}

function getVisualWorldPoints(el: AbstractGraphicElement, camera: Camera, m?: DOMMatrix): Point[] {
  if (el instanceof CircleElement) {
    const r = el.geometry.r + el.style.strokeWidth / 2;
    const count = Math.max(24, Math.round(24 * camera.zoom));
    const localPts = generateCirclePoints(el.geometry.cx, el.geometry.cy, r, count);
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

function getMovingBBox(worldPts: Point[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of worldPts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export class DragHandler {
  private _active = false;
  private snapEnabled = false;
  private snapToArtboard = false;
  private avoidCollisions = false;
  private lastMouseWorld = { x: 0, y: 0 };
  private currentDx = 0;
  private currentDy = 0;
  private targets: AbstractGraphicElement[] = [];
  private startMatrices = new Map<string, DOMMatrix>();
  private bus: CommandBus;
  private snap = new SvgSnap();
  private camera: Camera;
  private grid: SpatialGrid;
  private getElements: () => AbstractGraphicElement[];
  private getArtboardRect: () => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;

  public onDragStart: (() => void) | null = null;
  public onDragMove: (() => void) | null = null;
  public onDragEnd: (() => void) | null = null;

  public constructor(
    bus: CommandBus,
    camera: Camera,
    grid: SpatialGrid,
    getElements: () => AbstractGraphicElement[],
    getArtboardRect: () => {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null,
  ) {
    this.bus = bus;
    this.camera = camera;
    this.grid = grid;
    this.getElements = getElements;
    this.getArtboardRect = getArtboardRect;
  }

  public setAvoidCollisions(enabled: boolean): void {
    this.avoidCollisions = enabled;
  }

  public setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  public setSnapToArtboard(enabled: boolean): void {
    this.snapToArtboard = enabled;
  }

  public get isActive(): boolean {
    return this._active;
  }

  public get targetIds(): string[] {
    return this.targets.map((e) => e.id);
  }

  public tryStart(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): boolean {
    if (currentSelected.length === 0) return false;

    this._active = true;
    this.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };
    this.currentDx = 0;
    this.currentDy = 0;
    this.targets = Array.from(currentSelected);
    this.startMatrices.clear();
    for (const el of currentSelected) {
      this.startMatrices.set(el.id, new DOMMatrix(el.transform.matrix.toString()));
    }

    if (this.snapEnabled) {
      this.snap.reset();
      const selectedIds = new Set(this.targets.map((t) => t.id));
      const allElementsScreenPoints: { x: number; y: number }[][] = [];

      for (const el of this.getElements()) {
        if (selectedIds.has(el.id)) continue;
        const strokeOffsetPx = (el.style.strokeWidth / 2) * this.camera.zoom;
        const worldPts = getCenterlinePoints(el, this.camera);
        if (!worldPts || worldPts.length === 0) continue;
        let screenPts = worldPts.map((p) => this.camera.worldToScreen(p));
        if (strokeOffsetPx > 0) {
          const isClosed = el.type !== 'polyline' && el.type !== 'line';
          screenPts = offsetScreenPoints(screenPts, strokeOffsetPx, el.style.hasFill, isClosed);
        }
        allElementsScreenPoints.push(screenPts);
      }
      this.snap.buildTargetLinesAndNodes(allElementsScreenPoints);

      if (this.snapToArtboard) {
        const artboard = this.getArtboardRect();
        if (artboard) {
          const screen = this.camera.worldRectToScreen(artboard);
          this.snap.buildArtboardLines(screen);
        }
      }
    }

    this.onDragStart?.();
    return true;
  }

  public startWithoutCheck(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): void {
    if (currentSelected.length === 0) return;
    this._active = true;
    this.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };
    this.currentDx = 0;
    this.currentDy = 0;
    this.targets = Array.from(currentSelected);
    this.startMatrices.clear();
    for (const el of currentSelected) {
      this.startMatrices.set(el.id, new DOMMatrix(el.transform.matrix.toString()));
    }
    this.snap.reset();
    this.onDragStart?.();
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;

    const frameDx = worldPoint.x - this.lastMouseWorld.x;
    const frameDy = worldPoint.y - this.lastMouseWorld.y;
    this.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };

    if (Math.abs(frameDx) < 0.5 && Math.abs(frameDy) < 0.5 && (this.currentDx !== 0 || this.currentDy !== 0)) return;

    let targetDx = this.currentDx + frameDx;
    let targetDy = this.currentDy + frameDy;

    if (this.snapEnabled) {
      const movingScreenPoints: Point[] = [];

      for (const el of this.targets) {
        const start = this.startMatrices.get(el.id);
        if (!start) continue;

        const virtualMatrix = new DOMMatrix(start.toString());
        virtualMatrix.e += targetDx;
        virtualMatrix.f += targetDy;

        const worldPts = getVisualWorldPoints(el, this.camera, virtualMatrix);
        for (const wp of worldPts) {
          movingScreenPoints.push(this.camera.worldToScreen(wp));
        }
      }

      const snapResult = this.snap.computeCorrection(movingScreenPoints);
      this.snap.updatePull(frameDx * this.camera.zoom, frameDy * this.camera.zoom);

      targetDx += snapResult.correctionX / this.camera.zoom;
      targetDy += snapResult.correctionY / this.camera.zoom;
    }

    if (this.avoidCollisions) {
      const collisionNormal = this.checkSceneCollisions(targetDx, targetDy);

      if (collisionNormal) {
        const dotProduct = targetDx * collisionNormal.x + targetDy * collisionNormal.y;

        if (dotProduct < 0) {
          targetDx -= dotProduct * collisionNormal.x;
          targetDy -= dotProduct * collisionNormal.y;
        }

        if (!this.checkSceneCollisions(targetDx, targetDy)) {
          this.currentDx = targetDx;
          this.currentDy = targetDy;
        } else {
          const collisionX = this.checkSceneCollisions(targetDx, this.currentDy);
          const collisionY = this.checkSceneCollisions(this.currentDx, targetDy);

          if (!collisionX) {
            this.currentDx = targetDx;
          } else if (!collisionY) {
            this.currentDy = targetDy;
          }
        }

        targetDx = this.currentDx;
        targetDy = this.currentDy;
      } else {
        this.currentDx = targetDx;
        this.currentDy = targetDy;
      }
    } else {
      this.currentDx = targetDx;
      this.currentDy = targetDy;
    }

    for (const el of this.targets) {
      const start = this.startMatrices.get(el.id);
      if (!start) continue;
      const m = new DOMMatrix(start.toString());
      m.e += this.currentDx;
      m.f += this.currentDy;
      el.transform.matrix = m;
      el.invalidateHitArea();
    }

    this.onDragMove?.();
  }

  private checkSceneCollisions(dx: number, dy: number): Point | null {
    const allElements = this.getElements();
    const targetIdSet = new Set(this.targets.map((e) => e.id));
    const targetElements = allElements.filter((el) => !targetIdSet.has(el.id));

    for (const movingEl of this.targets) {
      const startMat = this.startMatrices.get(movingEl.id);
      if (!startMat) continue;

      const virtualMatrix = new DOMMatrix(startMat.toString());
      virtualMatrix.e += dx;
      virtualMatrix.f += dy;

      const movingPts = getVisualWorldPoints(movingEl, this.camera, virtualMatrix);
      if (movingPts.length === 0) continue;

      const movingBBox = getMovingBBox(movingPts);
      const candidateIds = this.grid.query(movingBBox.x, movingBBox.y, movingBBox.width, movingBBox.height);
      const candidates = targetElements.filter((el) => candidateIds.includes(el.id));

      for (const candidate of candidates) {
        const candidatePts = getVisualWorldPoints(candidate, this.camera);
        if (candidatePts.length === 0) continue;

        if (!polyIntersectsPoly(movingPts, candidatePts)) continue;

        if (movingEl instanceof CircleElement && candidate instanceof CircleElement) {
          const movingCenter = movingEl.getCenter();
          const candidateCenter = candidate.getCenter();
          const nx = movingCenter.x + dx - candidateCenter.x;
          const ny = movingCenter.y + dy - candidateCenter.y;
          const len = Math.hypot(nx, ny);
          return len > 0 ? { x: nx / len, y: ny / len } : { x: 0, y: -1 };
        }

        let bestNormal: Point = { x: 0, y: -1 };
        let maxPenetration = -Infinity;

        for (let i = 0; i < candidatePts.length; i++) {
          const p1 = candidatePts[i];
          const p2 = candidatePts[(i + 1) % candidatePts.length];

          const edgeX = p2.x - p1.x;
          const edgeY = p2.y - p1.y;
          const edgeLen = Math.hypot(edgeX, edgeY);
          if (edgeLen === 0) continue;

          const nX = -edgeY / edgeLen;
          const nY = edgeX / edgeLen;

          for (const mp of movingPts) {
            const pen = (p1.x - mp.x) * nX + (p1.y - mp.y) * nY;
            if (pen > maxPenetration) {
              maxPenetration = pen;
              bestNormal = { x: nX, y: nY };
            }
          }
        }
        return bestNormal;
      }
    }
    return null;
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;

    const ids = this.targets.map((e) => e.id);
    const cmd = createDragEndCommand(ids);
    this.bus.execute(cmd);

    this.targets = [];
    this.startMatrices.clear();
    this.snap.reset();
    this.onDragEnd?.();
  }

  public abort(): void {
    if (!this._active) return;
    this._active = false;
    this.targets = [];
    this.startMatrices.clear();
    this.snap.reset();
  }
}
