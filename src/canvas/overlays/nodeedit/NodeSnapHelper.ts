import type { Point, SnapAxisMode, BoundingBox } from '@/core/type';
import type { Camera } from '@/canvas/Camera';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { AdaptiveSnapEngine } from '@/core/math/snap/AdaptiveSnapEngine';
import { CircleElement } from '@/core/shapes/elements/CircleElement';
import { EllipseElement } from '@/core/shapes/elements/EllipseElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import {
  getCenterlinePoints,
  getScreenCurveTargets,
  extractBezierTargets,
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

export interface NodeSnapResult {
  x: number;
  y: number;
  snapped: boolean;
}

/**
 * Снап при драге узлов пути: к точкам/линиям/кривым других элементов
 * и к прочим узлам редактируемых элементов.
 */
export class NodeSnapHelper {
  private engine = new AdaptiveSnapEngine();
  private camera: Camera;
  private getElements: () => AbstractGraphicElement[];

  public enabled = true;
  public snapAxis: SnapAxisMode = 'both';

  constructor(camera: Camera, getElements: () => AbstractGraphicElement[]) {
    this.camera = camera;
    this.getElements = getElements;
  }

  reset(): void {
    this.engine.reset();
  }

  /**
   * @param editingIds элементы в режиме правки (их рёбра исключаем, но узлы добавляем как точки)
   * @param excludeWorld точки, которые сейчас двигаются (исключить из целей)
   */
  buildTargets(editingIds: Set<string>, extraNodes: Point[]): void {
    this.engine.reset();
    if (!this.enabled) return;

    const margin = SNAP_SPATIAL_MARGIN / this.camera.zoom;
    const dragBbox: BoundingBox = { x: Infinity, y: Infinity, width: 0, height: 0 };
    for (const p of extraNodes) {
      if (p.x < dragBbox.x) dragBbox.x = p.x;
      if (p.y < dragBbox.y) dragBbox.y = p.y;
      if (p.x > dragBbox.x + dragBbox.width) dragBbox.width = p.x - dragBbox.x;
      if (p.y > dragBbox.y + dragBbox.height) dragBbox.height = p.y - dragBbox.y;
    }
    dragBbox.x -= margin;
    dragBbox.y -= margin;
    dragBbox.width += margin * 2;
    dragBbox.height += margin * 2;
    const useSpatial =
      dragBbox.width > 0 && dragBbox.height > 0 &&
      isFinite(dragBbox.x) && isFinite(dragBbox.y);

    const screenPolys: Point[][] = [];
    const curveElements: AbstractGraphicElement[] = [];
    const bezierElements: AbstractGraphicElement[] = [];

    for (const el of this.getElements()) {
      if (editingIds.has(el.id)) continue;
      if (useSpatial && !bboxesOverlap(el.getTransformedBBox(), dragBbox)) continue;
      const worldPts = getCenterlinePoints(el, this.camera);
      if (!worldPts || worldPts.length > 1000) continue;
      if (worldPts.length > 0) {
        screenPolys.push(worldPts.map((p) => this.camera.worldToScreen(p)));
      }
      if (el instanceof CircleElement || el instanceof EllipseElement) {
        curveElements.push(el);
      } else if (el instanceof PathElement) {
        bezierElements.push(el);
      }
    }

    // Прочие узлы редактируемых элементов как одиночные точки-цели.
    for (const p of extraNodes) {
      screenPolys.push([this.camera.worldToScreen(p)]);
    }

    this.engine.buildTargetLinesAndNodes(screenPolys);

    const curveTargets = [
      ...getScreenCurveTargets(curveElements, this.camera),
      ...extractBezierTargets(bezierElements, this.camera),
    ];
    if (curveTargets.length > 0) this.engine.buildCurveTargets(curveTargets);
  }

  /** Скорректировать мировую точку узла с учётом снапа. */
  snapPoint(world: Point, frameDx: number, frameDy: number): NodeSnapResult {
    if (!this.enabled) return { x: world.x, y: world.y, snapped: false };
    const movingScreen = [this.camera.worldToScreen(world)];
    this.engine.setMotionContext(
      frameDx * this.camera.zoom,
      frameDy * this.camera.zoom,
    );
    const result = this.engine.computeCorrectionWithType(movingScreen);
    if (result.type === 'none')
      return { x: world.x, y: world.y, snapped: false };

    let sx = result.correctionX;
    let sy = result.correctionY;
    if (this.snapAxis === 'horizontal') sy = 0;
    else if (this.snapAxis === 'vertical') sx = 0;

    return {
      x: world.x + sx / this.camera.zoom,
      y: world.y + sy / this.camera.zoom,
      snapped: true,
    };
  }
}
