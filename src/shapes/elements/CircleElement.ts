import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { CircleHitArea } from '../modules/HitArea';

export class CircleElement extends AbstractGraphicElement {
  private _ha = new CircleHitArea();

  public geometry = { cx: 0, cy: 0, r: 0 };

  public constructor(id: string) {
    super(id, 'circle');
    this.subscribeGeometry('geometry.cx', 'geometry.cy', 'geometry.r');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(this.geometry.cx, this.geometry.cy, this.geometry.r);
  }

  public getBBox(): BoundingBox {
    return {
      x: this.geometry.cx - this.geometry.r,
      y: this.geometry.cy - this.geometry.r,
      width: this.geometry.r * 2,
      height: this.geometry.r * 2,
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
    if (data.r !== undefined) this.geometry.r = data.r as number;
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    (clone as CircleElement).geometry = { ...this.geometry };
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
    this.geometry.r = Math.max(bbox.width, bbox.height) / 2;
    this.transform.reset();
    this.rebuildHitArea();
  }

  public toOutlinePath(): import('./PathElement').PathElement {
    const { svgStringToOutlinePath } = require('./svg-outline-utils');
    const { cx, cy, r } = this.geometry;
    const fill = this.style.hasFill
      ? `fill="${this.style.fill}"`
      : 'fill="none"';
    const svgStr = `<circle cx="${cx}" cy="${cy}" r="${r}" ${fill} stroke="${this.style.stroke}" stroke-width="${this.style.strokeWidth}"/>`;
    return svgStringToOutlinePath(svgStr, `${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    const { cx, cy, r } = this.geometry;
    const pts: Point[] = [];
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (Math.PI * 2 * i) / steps;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return [pts];
  }
}
