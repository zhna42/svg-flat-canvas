import { SvgElement } from './SvgElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitAreaSimple } from '../modules/HitArea';

export class ImageElement extends SvgElement {
  private _ha = new RectHitAreaSimple();

  public constructor(id: string) {
    super(id, 'image', 'image');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    const x = this.getAttrNum('x', 0),
      y = this.getAttrNum('y', 0);
    const w = this.getAttrNum('width', 0),
      h = this.getAttrNum('height', 0);
    if (w <= 0 || h <= 0) return;
    this._ha.set([
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]);
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
      href:
        this.element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        '',
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      x: this.getAttrNum('x', 0),
      y: this.getAttrNum('y', 0),
      width: this.getAttrNum('width', 0),
      height: this.getAttrNum('height', 0),
      href:
        this.element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        '',
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) this.element.setAttribute('x', String(data.x));
    if (data.y !== undefined) this.element.setAttribute('y', String(data.y));
    if (data.width !== undefined)
      this.element.setAttribute('width', String(data.width));
    if (data.height !== undefined)
      this.element.setAttribute('height', String(data.height));
    if (data.href !== undefined)
      this.element.setAttributeNS(
        'http://www.w3.org/1999/xlink',
        'href',
        data.href as string,
      );
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as ImageElement;
    ['x', 'y', 'width', 'height', 'opacity', 'transform'].forEach((a) => {
      const v = this.element.getAttribute(a);
      if (v !== null) el.element.setAttribute(a, v);
    });
    const href = this.element.getAttributeNS(
      'http://www.w3.org/1999/xlink',
      'href',
    );
    if (href !== null)
      el.element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
    el.buildHitArea();
  }

  public setHref(href: string): void {
    this.element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
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
