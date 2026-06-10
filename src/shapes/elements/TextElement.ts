import { SvgElement } from './SvgElement';

export class TextElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'text', 'text');
  }

  public buildHitArea(): void {
    const bbox = this.getBBox();
    this._hitArea = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height },
    ];
  }

  public setTextContent(text: string): void {
    this.element.textContent = text;
    this.setDirty();
  }

  public getTextContent(): string {
    return this.element.textContent || '';
  }

  public clone(): TextElement {
    const el = new TextElement(this.id);
    [
      'x',
      'y',
      'fill',
      'stroke',
      'stroke-width',
      'opacity',
      'transform',
      'font-size',
      'font-family',
      'text-anchor',
    ].forEach((attr) => {
      const v = this.element.getAttribute(attr);
      if (v !== null) el.element.setAttribute(attr, v);
    });
    el.setTextContent(this.getTextContent());
    return el;
  }

  protected createClone(): TextElement {
    return new TextElement(this.id);
  }
}
