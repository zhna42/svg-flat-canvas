import { SvgElement } from './SvgElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitArea } from '../modules/HitArea';

export class RectElement extends SvgElement {
  private _ha = new RectHitArea();

  public constructor(id: string) {
    super(id, 'rect', 'rect');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(
      this.getAttrNum('x', 0),
      this.getAttrNum('y', 0),
      this.getAttrNum('width', 0),
      this.getAttrNum('height', 0),
      this.getAttrNum('rx', 0),
      this.getAttrNum('ry', 0),
      this.style.strokeWidth,
      this.style.hasFill,
    );
  }

  public getBBox(): BoundingBox {
    return {
      x: this.getAttrNum('x', 0),
      y: this.getAttrNum('y', 0),
      width: this.getAttrNum('width', 0),
      height: this.getAttrNum('height', 0),
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      x: this.getAttrNum('x', 0),
      y: this.getAttrNum('y', 0),
      width: this.getAttrNum('width', 0),
      height: this.getAttrNum('height', 0),
      rx: this.getAttrNum('rx', 0),
      ry: this.getAttrNum('ry', 0),
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      x: this.getAttrNum('x', 0),
      y: this.getAttrNum('y', 0),
      width: this.getAttrNum('width', 0),
      height: this.getAttrNum('height', 0),
      rx: this.getAttrNum('rx', 0),
      ry: this.getAttrNum('ry', 0),
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) this.element.setAttribute('x', String(data.x));
    if (data.y !== undefined) this.element.setAttribute('y', String(data.y));
    if (data.width !== undefined)
      this.element.setAttribute('width', String(data.width));
    if (data.height !== undefined)
      this.element.setAttribute('height', String(data.height));
    if (data.rx !== undefined) this.element.setAttribute('rx', String(data.rx));
    if (data.ry !== undefined) this.element.setAttribute('ry', String(data.ry));
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as RectElement;
    el.element.setAttribute('x', this.element.getAttribute('x') || '0');
    el.element.setAttribute('y', this.element.getAttribute('y') || '0');
    el.element.setAttribute('width', this.element.getAttribute('width') || '0');
    el.element.setAttribute(
      'height',
      this.element.getAttribute('height') || '0',
    );
    [
      'rx',
      'ry',
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

  public setX(x: number): void {
    this.element.setAttribute('x', String(x));
    this.buildHitArea();
    this.setDirty();
  }

  public setY(y: number): void {
    this.element.setAttribute('y', String(y));
    this.buildHitArea();
    this.setDirty();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const x = this.getAttrNum('x', 0) + dx;
    const y = this.getAttrNum('y', 0) + dy;
    this.element.setAttribute('x', String(x));
    this.element.setAttribute('y', String(y));
    this.buildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.element.setAttribute('x', String(bbox.x));
    this.element.setAttribute('y', String(bbox.y));
    this.element.setAttribute('width', String(bbox.width));
    this.element.setAttribute('height', String(bbox.height));
    this.transform.reset();
    this.matrix = this.transform.matrix;
    this.element.removeAttribute('transform');
    this.invalidateHitArea();
  }
}
