import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Point } from '@/types';
import { RectElement } from '@/shapes/elements/RectElement';
import { CircleElement } from '@/shapes/elements/CircleElement';
import { EllipseElement } from '@/shapes/elements/EllipseElement';
import { LineElement } from '@/shapes/elements/LineElement';
import { PolylineElement } from '@/shapes/elements/PolylineElement';
import { PolygonElement } from '@/shapes/elements/PolygonElement';
import type { CommandBus } from '@/commands/CommandBus';
import type { CreationElementType } from '@/commands/types';
import { Camera } from '@/camera/Camera';

const DEFAULT_STYLE = {
  fill: '#cccccc',
  stroke: '#000000',
  strokeWidth: 2,
  opacity: 1,
};

function snapAngleOrthogonal(dx: number, dy: number): { x: number; y: number } {
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy);
  return { x: Math.cos(snapped) * len, y: Math.sin(snapped) * len };
}

function pointsToString(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

export class CreationHandler {
  private bus: CommandBus;
  private svg: SVGSVGElement;
  private camera: Camera;
  private addElementToScene: (el: AbstractGraphicElement) => void;

  private _activeType: CreationElementType | null = null;
  private currentPreview: AbstractGraphicElement | null = null;
  private startWorld: Point = { x: 0, y: 0 };

  private multiPointPoints: Point[] = [];

  public onCreationStart: ((type: CreationElementType) => void) | null = null;
  public onCreationEnd: ((el: AbstractGraphicElement) => void) | null = null;
  public onElementFinalize: ((el: AbstractGraphicElement) => void) | null = null;

  public constructor(
    svg: SVGSVGElement,
    camera: Camera,
    bus: CommandBus,
    addElementToScene: (el: AbstractGraphicElement) => void,
  ) {
    this.svg = svg;
    this.camera = camera;
    this.bus = bus;
    this.addElementToScene = addElementToScene;
  }

  public get isActive(): boolean {
    return this.currentPreview !== null;
  }

  public get activeType(): CreationElementType | null {
    return this._activeType;
  }

  public setActiveType(type: CreationElementType | null): void {
    this._activeType = type;
  }

  public handleMouseDown(e: MouseEvent): boolean {
    if (!this._activeType) return false;

    const worldPt = this.mouseEventToWorld(e);
    this.start(worldPt, e.shiftKey);

    if (this.currentPreview) {
      e.preventDefault();
      return true;
    }
    return false;
  }

  public handleMouseMove(e: MouseEvent): boolean {
    if (!this.currentPreview) return false;

    const worldPt = this.mouseEventToWorld(e);
    this.move(worldPt, e.shiftKey);
    e.preventDefault();
    return true;
  }

  public handleMouseUp(e: MouseEvent): boolean {
    if (!this.currentPreview) return false;

    const worldPt = this.mouseEventToWorld(e);
    const type = this.currentPreview.type;

    if (type === 'polyline' || type === 'polygon') {
      this.addPointToMulti(worldPt);
      e.preventDefault();
      return true;
    }

    this.end(worldPt, e.shiftKey);
    e.preventDefault();
    return true;
  }

  public handleDblClick(e: MouseEvent): boolean {
    if (
      !this.currentPreview ||
      (this.currentPreview.type !== 'polyline' &&
        this.currentPreview.type !== 'polygon')
    )
      return false;

    const worldPt = this.mouseEventToWorld(e);
    this.finishMulti(worldPt);
    e.preventDefault();
    return true;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.currentPreview) return false;

    if (e.key === 'Escape') {
      const el = this.currentPreview;
      if (el.type === 'polyline' || el.type === 'polygon') {
        this.finishMulti();
      } else {
        this.abort();
      }
      e.preventDefault();
      return true;
    }

    if (
      e.key === 'Enter' &&
      (this.currentPreview.type === 'polyline' ||
        this.currentPreview.type === 'polygon')
    ) {
      this.finishMulti();
      e.preventDefault();
      return true;
    }

    return false;
  }

  public start(worldPoint: Point, _shiftHeld: boolean): void {
    const type = this._activeType;
    if (!type) return;

    this.startWorld = { x: worldPoint.x, y: worldPoint.y };

    if (type === 'polyline' || type === 'polygon') {
      if (this.currentPreview) {
        this.addPointToMulti(worldPoint);
        return;
      }
      this.multiPointPoints = [{ x: worldPoint.x, y: worldPoint.y }];
    }

    const preview = this.createElementInstance(type);
    preview.setFill(DEFAULT_STYLE.fill);
    preview.setStroke(DEFAULT_STYLE.stroke);
    preview.setStrokeWidth(DEFAULT_STYLE.strokeWidth);
    preview.setOpacity(DEFAULT_STYLE.opacity);

    if (type === 'polyline' || type === 'polygon') {
      (preview as PolylineElement | PolygonElement).points = pointsToString(
        this.multiPointPoints,
      );
      preview.buildHitArea();
    }

    this.currentPreview = preview;
    this.addElementToScene(preview);

    this.onCreationStart?.(type);
  }

  public move(worldPoint: Point, shiftHeld: boolean): void {
    const el = this.currentPreview;
    if (!el) return;

    if (el.type === 'polyline' || el.type === 'polygon') {
      const poly = el as PolylineElement | PolygonElement;
      const pts = [
        ...this.multiPointPoints,
        { x: worldPoint.x, y: worldPoint.y },
      ];
      poly.points = pointsToString(pts);
      poly.buildHitArea();
      poly.setDirty();
      return;
    }

    const start = this.startWorld;
    const current = worldPoint;

    this.updateGeometry(el, start, current, shiftHeld);
  }

  public end(worldPoint: Point, shiftHeld: boolean): void {
    const el = this.currentPreview;
    if (!el) return;

    if (el.type === 'polyline' || el.type === 'polygon') {
      return;
    }

    if (el.type === 'line') {
      const line = el as LineElement;
      if (shiftHeld) {
        const dx = worldPoint.x - this.startWorld.x;
        const dy = worldPoint.y - this.startWorld.y;
        const snapped = snapAngleOrthogonal(dx, dy);
        line.geometry.x2 = this.startWorld.x + snapped.x;
        line.geometry.y2 = this.startWorld.y + snapped.y;
        line.buildHitArea();
        line.setDirty();
      }
    }

    this.finalizeCreation(el);

    this.currentPreview = null;
    this._activeType = null;
  }

  public addPointToMulti(worldPoint: Point): void {
    if (!this.currentPreview) return;
    const type = this.currentPreview.type;
    if (type !== 'polyline' && type !== 'polygon') return;

    this.multiPointPoints.push({ x: worldPoint.x, y: worldPoint.y });
    const poly = this.currentPreview as PolylineElement | PolygonElement;
    const pts = [...this.multiPointPoints];
    poly.points = pointsToString(pts);
    poly.buildHitArea();
    poly.setDirty();
  }

  public finishMulti(worldPoint?: Point): void {
    const el = this.currentPreview;
    if (!el) return;
    if (el.type !== 'polyline' && el.type !== 'polygon') return;

    if (worldPoint) {
      const poly = el as PolylineElement | PolygonElement;
      const pts = [
        ...this.multiPointPoints,
        { x: worldPoint.x, y: worldPoint.y },
      ];
      poly.points = pointsToString(pts);
      poly.buildHitArea();
      poly.setDirty();
    }

    this.finalizeCreation(el);

    this.currentPreview = null;
    this.multiPointPoints = [];
    this._activeType = null;
  }

  public abort(): void {
    this.currentPreview = null;
    this.multiPointPoints = [];
    this._activeType = null;
  }

  private clientToSvg(e: MouseEvent): { x: number; y: number } {
    const point = this.svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return point.matrixTransform(ctm.inverse());
  }

  private mouseEventToWorld(e: MouseEvent): Point {
    const svgPt = this.clientToSvg(e);
    return this.camera.screenToWorld({ x: svgPt.x, y: svgPt.y });
  }

  private createElementInstance(
    type: CreationElementType,
  ): AbstractGraphicElement {
    const id = crypto.randomUUID();
    switch (type) {
      case 'rect':
        return new RectElement(id);
      case 'circle':
        return new CircleElement(id);
      case 'ellipse':
        return new EllipseElement(id);
      case 'line':
        return new LineElement(id);
      case 'polyline':
        return new PolylineElement(id);
      case 'polygon':
        return new PolygonElement(id);
    }
  }

  private updateGeometry(
    el: AbstractGraphicElement,
    start: Point,
    current: Point,
    shiftHeld: boolean,
  ): void {
    switch (el.type) {
      case 'rect': {
        const rect = el as RectElement;
        if (shiftHeld) {
          const size = Math.max(
            Math.abs(current.x - start.x),
            Math.abs(current.y - start.y),
          );
          rect.geometry.x = current.x < start.x ? start.x - size : start.x;
          rect.geometry.y = current.y < start.y ? start.y - size : start.y;
          rect.geometry.width = size;
          rect.geometry.height = size;
        } else {
          rect.geometry.x = Math.min(start.x, current.x);
          rect.geometry.y = Math.min(start.y, current.y);
          rect.geometry.width = Math.abs(current.x - start.x);
          rect.geometry.height = Math.abs(current.y - start.y);
        }
        rect.buildHitArea();
        rect.setDirty();
        break;
      }

      case 'circle': {
        const circle = el as CircleElement;
        circle.geometry.cx = start.x;
        circle.geometry.cy = start.y;
        circle.geometry.r = Math.hypot(
          current.x - start.x,
          current.y - start.y,
        );
        circle.buildHitArea();
        circle.setDirty();
        break;
      }

      case 'ellipse': {
        const ellipse = el as EllipseElement;
        ellipse.geometry.cx = start.x;
        ellipse.geometry.cy = start.y;
        const rx = Math.abs(current.x - start.x);
        const ry = shiftHeld ? rx : Math.abs(current.y - start.y);
        ellipse.geometry.rx = rx;
        ellipse.geometry.ry = ry;
        ellipse.buildHitArea();
        ellipse.setDirty();
        break;
      }

      case 'line': {
        const line = el as LineElement;
        line.geometry.x1 = start.x;
        line.geometry.y1 = start.y;
        if (shiftHeld) {
          const dx = current.x - start.x;
          const dy = current.y - start.y;
          const snapped = snapAngleOrthogonal(dx, dy);
          line.geometry.x2 = start.x + snapped.x;
          line.geometry.y2 = start.y + snapped.y;
        } else {
          line.geometry.x2 = current.x;
          line.geometry.y2 = current.y;
        }
        line.buildHitArea();
        line.setDirty();
        break;
      }
    }
  }

  private finalizeCreation(el: AbstractGraphicElement): void {
    el.setDirty();
    this.bus.getTimeMachine().push('CREATE');

    this.onElementFinalize?.(el);
    this.onCreationEnd?.(el);
  }
}
