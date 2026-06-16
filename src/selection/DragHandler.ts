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
      return {
        x: p.x + (dx / len) * strokeOffsetPx,
        y: p.y + (dy / len) * strokeOffsetPx,
      };
    });
  }
  if (isClosed) return offsetPolygon(screenPts, strokeOffsetPx);
  return offsetOpenPath(screenPts, strokeOffsetPx);
}

function getVisualWorldPoints(el: AbstractGraphicElement, camera: Camera, m?: DOMMatrix): Point[] {
  if (el instanceof CircleElement) {
    const cx = el.geometry.cx;
    const cy = el.geometry.cy;
    const r = el.geometry.r + el.style.strokeWidth / 2;
    const count = Math.max(24, Math.round(24 * camera.zoom));
    const localPts = generateCirclePoints(cx, cy, r, count);
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
  private startWorld = { x: 0, y: 0 };
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
  private lastSafeWorldDx = 0;
  private lastSafeWorldDy = 0;

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

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of currentSelected) {
      const bbox = el.getTransformedBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;
      if (bbox.x < minX) minX = bbox.x;
      if (bbox.y < minY) minY = bbox.y;
      if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
      if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
    }
    if (!isFinite(minX)) return false;

    const pad = Math.max((maxX - minX) * 0.25, (maxY - minY) * 0.25, 10);
    if (
      worldPoint.x < minX - pad ||
      worldPoint.x > maxX + pad ||
      worldPoint.y < minY - pad ||
      worldPoint.y > maxY + pad
    ) {
      return false;
    }

    this.startWithoutCheck(worldPoint, currentSelected);
    return true;
  }

  public startWithoutCheck(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): void {
    if (currentSelected.length === 0) return;
    this._active = true;
    this.startWorld = { x: worldPoint.x, y: worldPoint.y };
    this.targets = Array.from(currentSelected);
    this.startMatrices.clear();
    for (const el of currentSelected) {
      this.startMatrices.set(
        el.id,
        new DOMMatrix(el.transform.matrix.toString()),
      );
    }
    this.snap.reset();
    this.lastSafeWorldDx = 0;
    this.lastSafeWorldDy = 0;
    this.onDragStart?.();
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;

    const worldDx = worldPoint.x - this.startWorld.x;
    const worldDy = worldPoint.y - this.startWorld.y;

    if (Math.abs(worldDx) < 0.5 && Math.abs(worldDy) < 0.5) return;

    let finalWorldDx = worldDx;
    let finalWorldDy = worldDy;

    if (this.snapEnabled) {
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

      const movingScreenPoints: Point[] = [];
      for (const el of this.targets) {
        const start = this.startMatrices.get(el.id);
        if (!start) continue;

        const localPts = getCenterlinePoints(el, this.camera, true);
        if (!localPts || localPts.length === 0) continue;

        const virtualMatrix = new DOMMatrix(start.toString());
        virtualMatrix.e += worldDx;
        virtualMatrix.f += worldDy;

        const rawScreenPts: Point[] = [];
        for (const lp of localPts) {
          const vp = virtualMatrix.transformPoint(lp);
          rawScreenPts.push(this.camera.worldToScreen(vp));
        }

        const strokeOffsetPx = (el.style.strokeWidth / 2) * this.camera.zoom;
        if (strokeOffsetPx > 0) {
          const isClosed = el.type !== 'polyline' && el.type !== 'line';
          const offset = offsetScreenPoints(rawScreenPts, strokeOffsetPx, el.style.hasFill, isClosed);
          movingScreenPoints.push(...offset);
        } else {
          movingScreenPoints.push(...rawScreenPts);
        }
      }

      const snapResult = this.snap.computeCorrection(movingScreenPoints);

      this.snap.updatePull(worldDx * this.camera.zoom, worldDy * this.camera.zoom);

      const worldSnapX = snapResult.correctionX / this.camera.zoom;
      const worldSnapY = snapResult.correctionY / this.camera.zoom;

      finalWorldDx += worldSnapX;
      finalWorldDy += worldSnapY;
    }

    if (this.avoidCollisions && this.targets.length > 0) {
      const selectedIds = new Set(this.targets.map((t) => t.id));
      const el = this.targets[0];
      const start = this.startMatrices.get(el.id);
      if (start) {
        const testMatrix = new DOMMatrix(start.toString());
        testMatrix.e += finalWorldDx;
        testMatrix.f += finalWorldDy;
        const movingPts = getVisualWorldPoints(el, this.camera, testMatrix);
        const movingBBox = getMovingBBox(movingPts);

        const candidateIds = this.grid.query(movingBBox.x, movingBBox.y, movingBBox.width, movingBBox.height);

        const candidates = this.getElements().filter(
          (o) => !selectedIds.has(o.id) && candidateIds.includes(o.id),
        );
        const candidateWorldPts = candidates.map((o) => getVisualWorldPoints(o, this.camera));

        const testCollision = (dx: number, dy: number): boolean => {
          const m = new DOMMatrix(start.toString());
          m.e += dx;
          m.f += dy;
          const moving = getVisualWorldPoints(el, this.camera, m);
          return candidateWorldPts.some((cp) => cp.length >= 2 && polyIntersectsPoly(moving, cp));
        };

        if (testCollision(finalWorldDx, finalWorldDy)) {
          const safeX = !testCollision(finalWorldDx, this.lastSafeWorldDy);
          const safeY = !testCollision(this.lastSafeWorldDx, finalWorldDy);

          if (safeX) {
            this.lastSafeWorldDx = finalWorldDx;
          }
          if (safeY) {
            this.lastSafeWorldDy = finalWorldDy;
          }

          finalWorldDx = this.lastSafeWorldDx;
          finalWorldDy = this.lastSafeWorldDy;
        } else {
          this.lastSafeWorldDx = finalWorldDx;
          this.lastSafeWorldDy = finalWorldDy;
        }
      }
    }

    for (const el of this.targets) {
      const start = this.startMatrices.get(el.id);
      if (!start) continue;
      const m = new DOMMatrix(start.toString());
      m.e += finalWorldDx;
      m.f += finalWorldDy;
      el.transform.matrix = m;
      el.invalidateHitArea();
    }

    this.onDragMove?.();
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
