import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/canvas/Camera';
import type { Point, SnapAxisMode, WorldSnapResult } from '@/types';
import { AdaptiveSnapEngine } from '@/snap/AdaptiveSnapEngine';
import { CircleElement } from '@/shapes/elements/CircleElement';
import { EllipseElement } from '@/shapes/elements/EllipseElement';
import { PathElement } from '@/shapes/elements/PathElement';
import {
  getCenterlinePoints,
  offsetScreenPoints,
  getScreenCurveTargets,
  extractBezierTargets,
  getVisualWorldPoints,
} from '@/canvas/overlays/selection/drag/DragCollision';

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
    snapToCorners: boolean,
    snapToPlanes: boolean,
  ): void {
    this.engine.reset();
    const selectedIds = new Set(targets.map((t) => t.id));

    if (snapToCorners || snapToPlanes) {
      const allElementsScreenPoints: { x: number; y: number }[][] = [];

      for (const el of this.getElements()) {
        if (selectedIds.has(el.id)) continue;
        const strokeOffsetPx = (el.style.strokeWidth / 2) * this.camera.zoom;
        const worldPts = getCenterlinePoints(el, this.camera);
        if (!worldPts || worldPts.length === 0) continue;
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
          (e instanceof CircleElement || e instanceof EllipseElement),
      );
      const bezierElements = this.getElements().filter(
        (e) => !selectedIds.has(e.id) && e instanceof PathElement,
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
