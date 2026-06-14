import { SvgElement } from './SvgElement';

export class ImageElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'image', 'image');
  }

  public buildHitArea(): void {
    const x = this.getAttrAsNum('x', 0);
    const y = this.getAttrAsNum('y', 0);
    const w = this.getAttrAsNum('width', 0);
    const h = this.getAttrAsNum('height', 0);

    if (w <= 0 || h <= 0) return;

    this._hitArea = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }

  public setHref(href: string): void {
    this.element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
    this.setDirty();
  }

  public clone(): ImageElement {
    const el = new ImageElement(this.id);
    ['x', 'y', 'width', 'height', 'opacity', 'transform'].forEach((attr) => {
      const v = this.element.getAttribute(attr);
      if (v !== null) el.element.setAttribute(attr, v);
    });
    const href = this.element.getAttributeNS(
      'http://www.w3.org/1999/xlink',
      'href',
    );
    if (href !== null) {
      el.element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
    }
    return el;
  }

  protected createClone(): ImageElement {
    return new ImageElement(this.id);
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const x = this.getAttrAsNum('x', 0) + dx;
    const y = this.getAttrAsNum('y', 0) + dy;
    this.element.setAttribute('x', String(x));
    this.element.setAttribute('y', String(y));
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.element.setAttribute('x', String(bbox.x));
    this.element.setAttribute('y', String(bbox.y));
    this.element.setAttribute('width', String(bbox.width));
    this.element.setAttribute('height', String(bbox.height));
    super.flattenTransformToAttrs();
  }
}
