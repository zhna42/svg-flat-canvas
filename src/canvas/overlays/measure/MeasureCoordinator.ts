import type { Camera } from '@/canvas/Camera';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type {
  Point,
  MeasureTool,
  ProtractorMode,
  Measurement,
  MeasureResult,
  INodeEditable,
} from '@/types';
import type { HitTestEngine } from '@/core/HitTestEngine';
import { MeasureSession } from './MeasureSession';
import { MeasureRenderer } from './MeasureRenderer';
import { NodeSnapHelper } from '@/canvas/overlays/nodeedit/NodeSnapHelper';
import { pointToSegmentDist } from '@/math/geometry-utils';

const REF_SNAP_PX = 10;
const HOVER_PAD_PX = 20;
const MEASURE_HIT_PX = 6;
const AXIS_LEN = 100;

export interface MeasureDeps {
  camera: Camera;
  svg: SVGSVGElement;
  getElements: () => AbstractGraphicElement[];
  hitTestEngine: HitTestEngine;
  onToolChange?: (tool: MeasureTool | null) => void;
  onAdded?: (result: MeasureResult) => void;
}

let _measureNodeId = 0;

export class MeasureCoordinator {
  public readonly session = new MeasureSession();
  public readonly renderer: MeasureRenderer;
  private snap: NodeSnapHelper;
  private deps: MeasureDeps;

  private cursor: Point | null = null;
  private hoverPoints: Point[] = [];
  private pendingObjectAxis: { origin: Point; dir: Point } | null = null;

  constructor(deps: MeasureDeps) {
    this.deps = deps;
    this.renderer = new MeasureRenderer(deps.camera);
    this.snap = new NodeSnapHelper(deps.camera, deps.getElements);

    this.session.onChange = (): void => this.render();
    this.session.onAdded = (m): void =>
      this.deps.onAdded?.(this.session.getResult(m.id)!);
  }

  // ── Управление инструментом ──

  public get tool(): MeasureTool | null {
    return this.session.tool;
  }
  public get isActive(): boolean {
    return this.session.tool !== null;
  }

  public activate(tool: MeasureTool): void {
    this.session.setTool(tool);
    this.pendingObjectAxis = null;
    this.buildSnap();
    this.deps.svg.style.cursor = 'crosshair';
    this.deps.onToolChange?.(tool);
  }

  public deactivate(): void {
    this.session.setTool(null);
    this.cursor = null;
    this.hoverPoints = [];
    this.pendingObjectAxis = null;
    this.deps.svg.style.cursor = '';
    this.render();
    this.deps.onToolChange?.(null);
  }

  public setProtractorMode(mode: ProtractorMode): void {
    this.session.protractorMode = mode;
    this.pendingObjectAxis = null;
    this.session.cancelPending();
  }
  public getProtractorMode(): ProtractorMode {
    return this.session.protractorMode;
  }

  public clearAll(): void {
    this.session.clearAll();
  }
  public removeMeasurement(id: string): void {
    this.session.remove(id);
  }
  public getResults(): MeasureResult[] {
    return this.session.getResults();
  }
  public getResult(id: string): MeasureResult | null {
    return this.session.getResult(id);
  }

  public cancelPending(): void {
    this.pendingObjectAxis = null;
    this.session.cancelPending();
  }

  public onCameraChange(): void {
    if (this.isActive || this.session.getMeasurements().length > 0)
      this.render();
  }

  // ── InputHandler ──

  public onMouseDown(e: MouseEvent): boolean {
    if (e.button !== 0) return false;

    // Клик по существующему замеру — удалить его.
    if (this.session.getMeasurements().length > 0) {
      const hitId = this.hitMeasurement(this.eventToWorld(e));
      if (hitId) {
        this.session.remove(hitId);
        e.preventDefault();
        return true;
      }
    }

    if (!this.isActive) return false;
    this.buildSnap();
    const world = this.snapped(e);

    if (
      this.session.tool === 'protractor' &&
      this.session.protractorMode === 'objects'
    ) {
      const el = this.pickElement(world);
      if (el) this.handleObjectPick(el);
      e.preventDefault();
      return true;
    }

    this.session.addPoint(world);
    e.preventDefault();
    return true;
  }

  public onMouseMove(e: MouseEvent): boolean {
    if (!this.isActive) return false;
    this.cursor = this.snapped(e);
    this.updateHover(e);
    this.render();
    return false;
  }

  public onMouseUp(e: MouseEvent): boolean {
    if (!this.isActive || e.button !== 0) return false;
    return true;
  }

  // ── Внутреннее ──

  private handleObjectPick(el: AbstractGraphicElement): void {
    const axis = getElementAxis(el);
    if (!this.pendingObjectAxis) {
      this.pendingObjectAxis = axis;
      this.render();
      return;
    }
    const a = this.pendingObjectAxis;
    const vertex = lineIntersection(a, axis) ?? mid(a.origin, axis.origin);
    const m: Measurement = {
      id: `m${(_measureNodeId += 1)}`,
      kind: 'angle',
      vertex,
      p1: {
        x: vertex.x + a.dir.x * AXIS_LEN,
        y: vertex.y + a.dir.y * AXIS_LEN,
      },
      p2: {
        x: vertex.x + axis.dir.x * AXIS_LEN,
        y: vertex.y + axis.dir.y * AXIS_LEN,
      },
    };
    this.pendingObjectAxis = null;
    this.session.addMeasurement(m);
  }

  private updateHover(e: MouseEvent): void {
    this.hoverPoints = [];
    if (this.session.tool !== 'ruler') return;
    const world = this.eventToWorld(e);
    const el = this.elementForHover(world);
    if (el) this.hoverPoints = getReferencePoints(el);
  }

  /**
   * Элемент под курсором для ховера. Кроме попадания «внутрь» —
   * учитывает расширенный bbox, чтобы опорные точки за границей фигуры
   * не «сбрасывали» ховер.
   */
  private elementForHover(world: Point): AbstractGraphicElement | undefined {
    const inside = this.pickElement(world);
    if (inside) return inside;
    const pad = HOVER_PAD_PX / this.deps.camera.zoom;
    let best: AbstractGraphicElement | undefined;
    let bestD = Infinity;
    for (const el of this.deps.getElements()) {
      const b = el.getWorldBBox();
      if (
        world.x >= b.x - pad &&
        world.x <= b.x + b.width + pad &&
        world.y >= b.y - pad &&
        world.y <= b.y + b.height + pad
      ) {
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const d = Math.hypot(world.x - cx, world.y - cy);
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      }
    }
    return best;
  }

  private hitMeasurement(world: Point): string | null {
    const thr = MEASURE_HIT_PX / this.deps.camera.zoom;
    for (const m of this.session.getMeasurements()) {
      if (m.kind === 'distance') {
        if (
          pointToSegmentDist(world.x, world.y, m.a.x, m.a.y, m.b.x, m.b.y)
            .dist < thr
        ) {
          return m.id;
        }
      } else {
        const d1 = pointToSegmentDist(
          world.x,
          world.y,
          m.vertex.x,
          m.vertex.y,
          m.p1.x,
          m.p1.y,
        ).dist;
        const d2 = pointToSegmentDist(
          world.x,
          world.y,
          m.vertex.x,
          m.vertex.y,
          m.p2.x,
          m.p2.y,
        ).dist;
        if (Math.min(d1, d2) < thr) return m.id;
      }
    }
    return null;
  }

  private buildSnap(): void {
    const refs: Point[] = [];
    for (const el of this.deps.getElements()) {
      for (const p of getReferencePoints(el)) refs.push(p);
    }
    this.snap.buildTargets(new Set(), refs);
  }

  private snapped(e: MouseEvent): Point {
    const world = this.eventToWorld(e);
    const res = this.snap.snapPoint(world, 0, 0);
    // приоритет — явный снап к ближайшей опорной точке
    const ref = this.nearestRef(world, REF_SNAP_PX / this.deps.camera.zoom);
    return ref ?? { x: res.x, y: res.y };
  }

  private nearestRef(world: Point, maxDist: number): Point | null {
    let best: Point | null = null;
    let bestD = maxDist;
    for (const el of this.deps.getElements()) {
      for (const p of getReferencePoints(el)) {
        const d = Math.hypot(world.x - p.x, world.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    return best;
  }

  private pickElement(world: Point): AbstractGraphicElement | undefined {
    const { hits } = this.deps.hitTestEngine.queryPoint(world.x, world.y);
    return hits.length > 0
      ? (hits[hits.length - 1] as AbstractGraphicElement)
      : undefined;
  }

  private eventToWorld(e: MouseEvent): Point {
    const svg = this.deps.svg;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    const svgPt = ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    return this.deps.camera.screenToWorld({ x: svgPt.x, y: svgPt.y });
  }

  private render(): void {
    this.renderer.setData({
      measurements: this.session.getMeasurements(),
      pending: this.session.getPending(),
      cursor: this.isActive ? this.cursor : null,
      hoverPoints: this.hoverPoints,
      tool: this.session.tool,
    });
  }
}

function isNodeEditable(el: unknown): el is INodeEditable {
  return !!el && typeof (el as INodeEditable).toEditModel === 'function';
}

/** Опорные точки элемента: углы bbox, середины сторон, центр, вершины. */
function getReferencePoints(el: AbstractGraphicElement): Point[] {
  const pts: Point[] = [];
  const corners = el.getWorldCorners();
  for (let i = 0; i < corners.length; i++) {
    pts.push(corners[i]);
    pts.push(mid(corners[i], corners[(i + 1) % corners.length]));
  }
  pts.push(el.getCenter());

  if (isNodeEditable(el)) {
    const model = el.toEditModel();
    for (const c of model.contours) for (const n of c.nodes) pts.push(n.anchor);
  } else if (el.type === 'line') {
    for (const p of el.getWorldHitPoints()) pts.push(p);
  }
  return pts;
}

/** Ось элемента (origin + направление) для режима «между объектами». */
function getElementAxis(el: AbstractGraphicElement): {
  origin: Point;
  dir: Point;
} {
  if (el.type === 'line') {
    const hp = el.getWorldHitPoints();
    if (hp.length >= 2) {
      const dx = hp[1].x - hp[0].x;
      const dy = hp[1].y - hp[0].y;
      const len = Math.hypot(dx, dy) || 1;
      return { origin: mid(hp[0], hp[1]), dir: { x: dx / len, y: dy / len } };
    }
  }
  const m = el.transform.matrix;
  const angle = Math.atan2(m.b, m.a);
  return {
    origin: el.getCenter(),
    dir: { x: Math.cos(angle), y: Math.sin(angle) },
  };
}

function lineIntersection(
  a: { origin: Point; dir: Point },
  b: { origin: Point; dir: Point },
): Point | null {
  const denom = a.dir.x * b.dir.y - a.dir.y * b.dir.x;
  if (Math.abs(denom) < 1e-6) return null;
  const dx = b.origin.x - a.origin.x;
  const dy = b.origin.y - a.origin.y;
  const t = (dx * b.dir.y - dy * b.dir.x) / denom;
  return { x: a.origin.x + a.dir.x * t, y: a.origin.y + a.dir.y * t };
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
