import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/canvas/Camera';
import type { Point, SnapAxisMode, WorldSnapResult, BoundingBox } from '@/core/type';
import { AdaptiveSnapEngine } from '@/core/math/snap/AdaptiveSnapEngine';
import { CircleElement } from '@/core/shapes/elements/CircleElement';
import { EllipseElement } from '@/core/shapes/elements/EllipseElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import {
  getCenterlinePoints,
  offsetScreenPoints,
  getScreenCurveTargets,
  extractBezierTargets,
  getVisualWorldPoints,
} from '@/canvas/overlays/selection/drag/DragCollision';

const SNAP_SPATIAL_MARGIN = 300000;

function bboxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

export class DragSnapHelper {
  private engine = new AdaptiveSnapEngine();
  private camera: Camera;
  private getElements: () => AbstractGraphicElement[];
  private getArtboardRect: () => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  private getGuidelines: () => Array<{
    orientation: 'v' | 'h';
    position: number;
  }>;
  private getGridLines: () => Array<{
    orientation: 'v' | 'h';
    position: number;
  }>;

  public snapToGuidelines = false;
  public snapToGrid = false;
  public snapToElements = true;
  public snapAxis: SnapAxisMode = 'both';

  constructor(
    camera: Camera,
    getElements: () => AbstractGraphicElement[],
    getArtboardRect: () => {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null,
    getGuidelines: () => Array<{
      orientation: 'v' | 'h';
      position: number;
    }>,
    getGridLines: () => Array<{
      orientation: 'v' | 'h';
      position: number;
    }>,
  ) {
    this.camera = camera;
    this.getElements = getElements;
    this.getArtboardRect = getArtboardRect;
    this.getGuidelines = getGuidelines;
    this.getGridLines = getGridLines;
  }

  reset(): void {
    this.engine.reset();
  }

  buildTargets(
    targets: AbstractGraphicElement[],
    snapToArtboard: boolean,
    _snapToCorners: boolean,
    _snapToPlanes: boolean,
  ): void {
    this.engine.reset();
    const selectedIds = new Set(targets.map((t) => t.id));

    const margin = SNAP_SPATIAL_MARGIN / this.camera.zoom;
    const dragBbox: BoundingBox = { x: Infinity, y: Infinity, width: 0, height: 0 };
    for (const t of targets) {
      const b = t.getTransformedBBox();
      if (b.width === 0 && b.height === 0) continue;
      const x2 = b.x + b.width;
      const y2 = b.y + b.height;
      if (b.x < dragBbox.x) dragBbox.x = b.x;
      if (b.y < dragBbox.y) dragBbox.y = b.y;
      if (x2 > dragBbox.x + dragBbox.width) dragBbox.width = x2 - dragBbox.x;
      if (y2 > dragBbox.y + dragBbox.height) dragBbox.height = y2 - dragBbox.y;
    }
    dragBbox.x -= margin;
    dragBbox.y -= margin;
    dragBbox.width += margin * 2;
    dragBbox.height += margin * 2;
    const useSpatial =
      dragBbox.width > 0 && dragBbox.height > 0 &&
      isFinite(dragBbox.x) && isFinite(dragBbox.y);

    if (this.snapToElements) {
      const allElementsScreenPoints: { x: number; y: number }[][] = [];

      for (const el of this.getElements()) {
        if (selectedIds.has(el.id)) continue;
        if (useSpatial && !bboxesOverlap(el.getTransformedBBox(), dragBbox)) continue;
        const strokeOffsetPx = (el.style.strokeWidth / 2) * this.camera.zoom;
        const worldPts = getCenterlinePoints(el, this.camera);
        if (!worldPts || worldPts.length === 0) continue;
        if (worldPts.length > 1000) continue;
        let screenPts = worldPts.map((p) => this.camera.worldToScreen(p));
        if (strokeOffsetPx > 0) {
          const isClosed = el.type !== 'polyline' && el.type !== 'line';
          screenPts = offsetScreenPoints(
            screenPts,
            strokeOffsetPx,
            el.style.hasFill,
            isClosed,
          );
        }
        allElementsScreenPoints.push(screenPts);
      }
      this.engine.buildTargetLinesAndNodes(allElementsScreenPoints);

      const curveElements = this.getElements().filter(
        (e) =>
          !selectedIds.has(e.id) &&
          (!useSpatial || bboxesOverlap(e.getTransformedBBox(), dragBbox)) &&
          (e instanceof CircleElement || e instanceof EllipseElement),
      );
      const bezierElements = this.getElements().filter(
        (e) =>
          !selectedIds.has(e.id) &&
          (!useSpatial || bboxesOverlap(e.getTransformedBBox(), dragBbox)) &&
          e instanceof PathElement,
      );
      const allCurveTargets = [
        ...getScreenCurveTargets(curveElements, this.camera),
        ...extractBezierTargets(bezierElements, this.camera),
      ];
      if (allCurveTargets.length > 0) {
        this.engine.buildCurveTargets(allCurveTargets);
      }
    }

    if (snapToArtboard) {
      const artboard = this.getArtboardRect();
      if (artboard) {
        const screen = this.camera.worldRectToScreen(artboard);
        this.engine.buildArtboardLines(screen);
      }
    }

    if (this.snapToGuidelines) {
      const guidelines = this.getGuidelines();
      const screenLines: { x: number; y: number }[][] = [];
      for (const g of guidelines) {
        const pos = this.camera.worldToScreen({
          x: g.orientation === 'v' ? g.position : 0,
          y: g.orientation === 'h' ? g.position : 0,
        });
        if (g.orientation === 'v') {
          screenLines.push([
            { x: pos.x, y: -1e8 },
            { x: pos.x, y: 1e8 },
          ]);
        } else {
          screenLines.push([
            { x: -1e8, y: pos.y },
            { x: 1e8, y: pos.y },
          ]);
        }
      }
      if (screenLines.length > 0) {
        this.engine.addStaticTargets(screenLines);
      }
    }

    if (this.snapToGrid) {
      const gridLines = this.getGridLines();
      const screenLines: { x: number; y: number }[][] = [];
      for (const g of gridLines) {
        const pos = this.camera.worldToScreen({
          x: g.orientation === 'v' ? g.position : 0,
          y: g.orientation === 'h' ? g.position : 0,
        });
        if (g.orientation === 'v') {
          screenLines.push([
            { x: pos.x, y: -1e8 },
            { x: pos.x, y: 1e8 },
          ]);
        } else {
          screenLines.push([
            { x: -1e8, y: pos.y },
            { x: 1e8, y: pos.y },
          ]);
        }
      }
      if (screenLines.length > 0) {
        this.engine.addStaticTargets(screenLines);
      }
    }
  }

  computeCorrection(
    targets: AbstractGraphicElement[],
    startMatrices: Map<string, DOMMatrix>,
    currentDx: number,
    currentDy: number,
    frameDx: number,
    frameDy: number,
  ): { correctionX: number; correctionY: number } {
    const result = this.computeWorldSnap(
      targets,
      startMatrices,
      currentDx,
      currentDy,
      frameDx,
      frameDy,
    );
    return {
      correctionX: result.screenDx,
      correctionY: result.screenDy,
    };
  }

  computeWorldSnap(
    targets: AbstractGraphicElement[],
    startMatrices: Map<string, DOMMatrix>,
    currentDx: number,
    currentDy: number,
    frameDx: number,
    frameDy: number,
  ): WorldSnapResult {
    const empty: WorldSnapResult = {
      correctionDx: 0,
      correctionDy: 0,
      screenDx: 0,
      screenDy: 0,
      type: 'point',
    };

    const movingScreenPoints: Point[] = [];
    const testTargetDx = currentDx + frameDx;
    const testTargetDy = currentDy + frameDy;

    for (const el of targets) {
      const start = startMatrices.get(el.id);
      if (!start) continue;

      const virtualMatrix = new DOMMatrix(start.toString());
      virtualMatrix.e += testTargetDx;
      virtualMatrix.f += testTargetDy;

      const worldPts = getVisualWorldPoints(el, this.camera, virtualMatrix);
      for (const wp of worldPts) {
        movingScreenPoints.push(this.camera.worldToScreen(wp));
      }
    }

    this.engine.setMotionContext(
      frameDx * this.camera.zoom,
      frameDy * this.camera.zoom,
    );
    const result = this.engine.computeCorrectionWithType(movingScreenPoints);

    if (result.type === 'none') return empty;

    let screenDx = result.correctionX;
    let screenDy = result.correctionY;

    if (this.snapAxis === 'horizontal') screenDy = 0;
    else if (this.snapAxis === 'vertical') screenDx = 0;

    return {
      correctionDx: screenDx / this.camera.zoom,
      correctionDy: screenDy / this.camera.zoom,
      screenDx,
      screenDy,
      type: result.type,
      lineStartX: result.lineStartX,
      lineStartY: result.lineStartY,
      lineEndX: result.lineEndX,
      lineEndY: result.lineEndY,
    };
  }
}
