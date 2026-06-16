import { SvgElement } from './SvgElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitAreaSimple } from '../modules/HitArea';

export class TextElement extends SvgElement {
  private _ha = new RectHitAreaSimple();

  public constructor(id: string) {
    super(id, 'text', 'text');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    const x = parseFloat(this.element.getAttribute('x') || '0');
    const y = parseFloat(this.element.getAttribute('y') || '0');
    const fontSize = parseFloat(this.element.getAttribute('font-size') || '16');
    const text = this.element.textContent || '';
    const approxWidth = text.length * fontSize * 0.6;
    this._ha.set([
      { x, y: y - fontSize },
      { x: x + approxWidth, y: y - fontSize },
      { x: x + approxWidth, y },
      { x, y },
    ]);
  }

  public getBBox(): BoundingBox {
    const x = parseFloat(this.element.getAttribute('x') || '0');
    const y = parseFloat(this.element.getAttribute('y') || '0');
    const fontSize = parseFloat(this.element.getAttribute('font-size') || '16');
    const text = this.element.textContent || '';
    return {
      x,
      y: y - fontSize,
      width: text.length * fontSize * 0.6,
      height: fontSize,
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      x: this.element.getAttribute('x') || '0',
      y: this.element.getAttribute('y') || '0',
      'font-size': this.element.getAttribute('font-size') || '16',
      'font-family': this.element.getAttribute('font-family') || '',
      'text-anchor': this.element.getAttribute('text-anchor') || 'start',
      textContent: this.element.textContent || '',
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      x: this.element.getAttribute('x') || '0',
      y: this.element.getAttribute('y') || '0',
      fontSize: this.element.getAttribute('font-size') || '16',
      fontFamily: this.element.getAttribute('font-family') || '',
      textAnchor: this.element.getAttribute('text-anchor') || 'start',
      textContent: this.element.textContent || '',
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) this.element.setAttribute('x', data.x as string);
    if (data.y !== undefined) this.element.setAttribute('y', data.y as string);
    if (data.fontSize !== undefined)
      this.element.setAttribute('font-size', data.fontSize as string);
    if (data.fontFamily !== undefined)
      this.element.setAttribute('font-family', data.fontFamily as string);
    if (data.textAnchor !== undefined)
      this.element.setAttribute('text-anchor', data.textAnchor as string);
    if (data.textContent !== undefined)
      this.element.textContent = data.textContent as string;
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as TextElement;
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
    ].forEach((a) => {
      const v = this.element.getAttribute(a);
      if (v !== null) el.element.setAttribute(a, v);
    });
    el.setTextContent(this.getTextContent());
    el.buildHitArea();
  }

  public setTextContent(text: string): void {
    this.element.textContent = text;
    this.buildHitArea();
    this.setDirty();
  }

  public getTextContent(): string {
    return this.element.textContent || '';
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const x = parseFloat(this.element.getAttribute('x') || '0') + dx;
    const y = parseFloat(this.element.getAttribute('y') || '0') + dy;
    this.element.setAttribute('x', String(x));
    this.element.setAttribute('y', String(y));
    this.buildHitArea();
  }
}
