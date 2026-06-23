import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/camera/Camera';
import type { Point } from '@/types';
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
} from '@/selection/drag/DragCollision';

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

  constructor(
    camera: Camera,
    getElements: () => AbstractGraphicElement[],
    getArtboardRect: () => {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null,
  ) {
    this.camera = camera;
    this.getElements = getElements;
    this.getArtboardRect = getArtboardRect;
  }

  reset(): void {
    this.engine.reset();
  }

  buildTargets(
    targets: AbstractGraphicElement[],
    snapToArtboard: boolean,
  ): void {
    this.engine.reset();
    const selectedIds = new Set(targets.map((t) => t.id));
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

    if (snapToArtboard) {
      const artboard = this.getArtboardRect();
      if (artboard) {
        const screen = this.camera.worldRectToScreen(artboard);
        this.engine.buildArtboardLines(screen);
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
    return this.engine.computeCorrection(movingScreenPoints);
  }
}
