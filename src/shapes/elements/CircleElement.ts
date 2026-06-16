import { SvgElement } from './SvgElement';
import type { Point, BoundingBox } from '@/types';
import { CircleHitArea } from '../modules/HitArea';

export class CircleElement extends SvgElement {
  private _ha = new CircleHitArea();

  public constructor(id: string) {
    super(id, 'circle', 'circle');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(
      this.getAttrNum('cx', 0),
      this.getAttrNum('cy', 0),
      this.getAttrNum('r', 0),
    );
  }

  public getBBox(): BoundingBox {
    const cx = this.getAttrNum('cx', 0),
      cy = this.getAttrNum('cy', 0),
      r = this.getAttrNum('r', 0);
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      cx: this.getAttrNum('cx', 0),
      cy: this.getAttrNum('cy', 0),
      r: this.getAttrNum('r', 0),
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      cx: this.getAttrNum('cx', 0),
      cy: this.getAttrNum('cy', 0),
      r: this.getAttrNum('r', 0),
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.cx !== undefined) this.element.setAttribute('cx', String(data.cx));
    if (data.cy !== undefined) this.element.setAttribute('cy', String(data.cy));
    if (data.r !== undefined) this.element.setAttribute('r', String(data.r));
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as CircleElement;
    [
      'cx',
      'cy',
      'r',
      'fill',
      'stroke',
      'stroke-width',
      'opacity',
      'transform',
    ].forEach((a) => {
      const v = this.element.getAttribute(a);
      if (v !== null) el.element.setAttribute(a, v);
    });
    el.buildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const cx = this.getAttrNum('cx', 0) + dx;
    const cy = this.getAttrNum('cy', 0) + dy;
    this.element.setAttribute('cx', String(cx));
    this.element.setAttribute('cy', String(cy));
    this.buildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.element.setAttribute('cx', String(bbox.x + bbox.width / 2));
    this.element.setAttribute('cy', String(bbox.y + bbox.height / 2));
    this.element.setAttribute(
      'r',
      String(Math.max(bbox.width, bbox.height) / 2),
    );
    this.transform.reset();
    this.matrix = this.transform.matrix;
    this.element.removeAttribute('transform');
    this.invalidateHitArea();
  }
}
