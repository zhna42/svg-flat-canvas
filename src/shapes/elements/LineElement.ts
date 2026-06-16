import { SvgElement } from './SvgElement';
import type { Point, BoundingBox } from '@/types';
import { LineHitArea } from '../modules/HitArea';

export class LineElement extends SvgElement {
  private _ha = new LineHitArea();

  public constructor(id: string) {
    super(id, 'line', 'line');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(
      this.getAttrNum('x1', 0),
      this.getAttrNum('y1', 0),
      this.getAttrNum('x2', 0),
      this.getAttrNum('y2', 0),
      this.style.strokeWidth,
    );
  }

  public getBBox(): BoundingBox {
    const x1 = this.getAttrNum('x1', 0),
      y1 = this.getAttrNum('y1', 0);
    const x2 = this.getAttrNum('x2', 0),
      y2 = this.getAttrNum('y2', 0);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      x1: this.getAttrNum('x1', 0),
      y1: this.getAttrNum('y1', 0),
      x2: this.getAttrNum('x2', 0),
      y2: this.getAttrNum('y2', 0),
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      x1: this.getAttrNum('x1', 0),
      y1: this.getAttrNum('y1', 0),
      x2: this.getAttrNum('x2', 0),
      y2: this.getAttrNum('y2', 0),
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x1 !== undefined) this.element.setAttribute('x1', String(data.x1));
    if (data.y1 !== undefined) this.element.setAttribute('y1', String(data.y1));
    if (data.x2 !== undefined) this.element.setAttribute('x2', String(data.x2));
    if (data.y2 !== undefined) this.element.setAttribute('y2', String(data.y2));
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as LineElement;
    [
      'x1',
      'y1',
      'x2',
      'y2',
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
    const x1 = this.getAttrNum('x1', 0) + dx,
      y1 = this.getAttrNum('y1', 0) + dy;
    const x2 = this.getAttrNum('x2', 0) + dx,
      y2 = this.getAttrNum('y2', 0) + dy;
    this.element.setAttribute('x1', String(x1));
    this.element.setAttribute('y1', String(y1));
    this.element.setAttribute('x2', String(x2));
    this.element.setAttribute('y2', String(y2));
    this.buildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    const x1 = this.getAttrNum('x1', 0),
      y1 = this.getAttrNum('y1', 0);
    const x2 = this.getAttrNum('x2', 0),
      y2 = this.getAttrNum('y2', 0);
    const cx = (x1 + x2) / 2,
      cy = (y1 + y2) / 2;
    const halfDx = (x2 - x1) / 2,
      halfDy = (y2 - y1) / 2;
    const s = Math.max(
      bbox.width / (Math.abs(halfDx) * 2 || 1),
      bbox.height / (Math.abs(halfDy) * 2 || 1),
    );
    this.element.setAttribute('x1', String(cx - halfDx * s));
    this.element.setAttribute('y1', String(cy - halfDy * s));
    this.element.setAttribute('x2', String(cx + halfDx * s));
    this.element.setAttribute('y2', String(cy + halfDy * s));
    this.transform.reset();
    this.matrix = this.transform.matrix;
    this.element.removeAttribute('transform');
    this.invalidateHitArea();
  }
}
