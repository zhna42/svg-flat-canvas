import { SvgElement } from './SvgElement';
import { MAX_HIT_POINTS } from '@/constants';

export class EllipseElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'ellipse', 'ellipse');
  }

  public buildHitArea(): void {
    const cx = this.getAttrAsNum('cx', 0);
    const cy = this.getAttrAsNum('cy', 0);
    const rx = this.getAttrAsNum('rx', 0);
    const ry = this.getAttrAsNum('ry', 0);

    if (rx <= 0 || ry <= 0) return;

    const points = MAX_HIT_POINTS;
    this._hitArea = [];
    for (let i = 0; i < points; i++) {
      const angle = (2 * Math.PI * i) / points;
      this._hitArea.push({
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      });
    }
  }

  public clone(): EllipseElement {
    const el = new EllipseElement(this.id);
    [
      'cx',
      'cy',
      'rx',
      'ry',
      'fill',
      'stroke',
      'stroke-width',
      'opacity',
      'transform',
    ].forEach((attr) => {
      const v = this.element.getAttribute(attr);
      if (v !== null) el.element.setAttribute(attr, v);
    });
    return el;
  }

  protected createClone(): EllipseElement {
    return new EllipseElement(this.id);
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const cx = this.getAttrAsNum('cx', 0) + dx;
    const cy = this.getAttrAsNum('cy', 0) + dy;
    this.element.setAttribute('cx', String(cx));
    this.element.setAttribute('cy', String(cy));
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.element.setAttribute('cx', String(bbox.x + bbox.width / 2));
    this.element.setAttribute('cy', String(bbox.y + bbox.height / 2));
    this.element.setAttribute('rx', String(bbox.width / 2));
    this.element.setAttribute('ry', String(bbox.height / 2));
    super.flattenTransformToAttrs();
  }
}
