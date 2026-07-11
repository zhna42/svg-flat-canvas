import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/core/type';
import { EllipseHitArea } from '../modules/HitArea';

export class EllipseElement extends AbstractGraphicElement {
  _ha = new EllipseHitArea();

  public geometry = { cx: 0, cy: 0, rx: 0, ry: 0 };

  public constructor(id: string) {
    super(id, 'ellipse');
    this.subscribeGeometry(
      'geometry.cx',
      'geometry.cy',
      'geometry.rx',
      'geometry.ry',
    );
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(
      this.geometry.cx,
      this.geometry.cy,
      this.geometry.rx,
      this.geometry.ry,
    );
  }

  public getBBox(): BoundingBox {
    return {
      x: this.geometry.cx - this.geometry.rx,
      y: this.geometry.cy - this.geometry.ry,
      width: this.geometry.rx * 2,
      height: this.geometry.ry * 2,
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { ...this.geometry };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { ...this.geometry };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.cx !== undefined) this.geometry.cx = data.cx as number;
    if (data.cy !== undefined) this.geometry.cy = data.cy as number;
    if (data.rx !== undefined) this.geometry.rx = data.rx as number;
    if (data.ry !== undefined) this.geometry.ry = data.ry as number;
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    (clone as EllipseElement).geometry = { ...this.geometry };
    clone.rebuildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.geometry.cx += dx;
    this.geometry.cy += dy;
    this.rebuildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.geometry.cx = bbox.x + bbox.width / 2;
    this.geometry.cy = bbox.y + bbox.height / 2;
    this.geometry.rx = bbox.width / 2;
    this.geometry.ry = bbox.height / 2;
    this.transform.reset();
    this.rebuildHitArea();
  }

  public toOutlinePath(): import('./PathElement').PathElement {
    const { svgStringToOutlinePath } = require('./svg-outline-utils');
    const { cx, cy, rx, ry } = this.geometry;
    const fill = this.style.hasFill
      ? `fill="${this.style.fill}"`
      : 'fill="none"';
    const svgStr = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${fill} stroke="${this.style.stroke}" stroke-width="${this.style.strokeWidth}"/>`;
    return svgStringToOutlinePath(svgStr, `${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    const { cx, cy, rx, ry } = this.geometry;
    const pts: Point[] = [];
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (Math.PI * 2 * i) / steps;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return [pts];
  }
}
