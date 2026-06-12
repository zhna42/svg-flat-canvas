import { SvgElement } from './SvgElement';

export class TextElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'text', 'text');
  }

  public buildHitArea(): void {
    const x = parseFloat(this.element.getAttribute('x') || '0');
    const y = parseFloat(this.element.getAttribute('y') || '0');
    const fontSize = parseFloat(this.element.getAttribute('font-size') || '16');
    const text = this.element.textContent || '';
    const approxWidth = text.length * fontSize * 0.6;

    this._hitArea = [
      { x, y: y - fontSize },
      { x: x + approxWidth, y: y - fontSize },
      { x: x + approxWidth, y },
      { x, y },
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

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const x = parseFloat(this.element.getAttribute('x') || '0') + dx;
    const y = parseFloat(this.element.getAttribute('y') || '0') + dy;
    this.element.setAttribute('x', String(x));
    this.element.setAttribute('y', String(y));
  }
}
