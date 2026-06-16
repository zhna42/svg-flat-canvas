import { SvgElement } from './SvgElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitAreaSimple } from '../modules/HitArea';

export class TextElement extends SvgElement {
  private _ha = new RectHitAreaSimple();

  public posX = '0';
  public posY = '0';
  public fontSize = '16';
  public fontFamily = '';
  public textAnchor = 'start';
  public textContent = '';

  public constructor(id: string) {
    super(id, 'text', 'text');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    const fx = parseFloat(this.posX),
      fy = parseFloat(this.posY),
      fsize = parseFloat(this.fontSize);
    const approxWidth = this.textContent.length * fsize * 0.6;
    this._ha.set([
      { x: fx, y: fy - fsize },
      { x: fx + approxWidth, y: fy - fsize },
      { x: fx + approxWidth, y: fy },
      { x: fx, y: fy },
    ]);
  }

  public getBBox(): BoundingBox {
    const fx = parseFloat(this.posX),
      fy = parseFloat(this.posY),
      fsize = parseFloat(this.fontSize);
    return {
      x: fx,
      y: fy - fsize,
      width: this.textContent.length * fsize * 0.6,
      height: fsize,
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      x: this.posX,
      y: this.posY,
      'font-size': this.fontSize,
      'font-family': this.fontFamily,
      'text-anchor': this.textAnchor,
      textContent: this.textContent,
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      x: this.posX,
      y: this.posY,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      textAnchor: this.textAnchor,
      textContent: this.textContent,
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) this.posX = data.x as string;
    if (data.y !== undefined) this.posY = data.y as string;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize as string;
    if (data.fontFamily !== undefined)
      this.fontFamily = data.fontFamily as string;
    if (data.textAnchor !== undefined)
      this.textAnchor = data.textAnchor as string;
    if (data.textContent !== undefined)
      this.textContent = data.textContent as string;
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as TextElement;
    el.posX = this.posX;
    el.posY = this.posY;
    el.fontSize = this.fontSize;
    el.fontFamily = this.fontFamily;
    el.textAnchor = this.textAnchor;
    el.textContent = this.textContent;
    el.buildHitArea();
  }

  public setTextContent(text: string): void {
    this.textContent = text;
    this.buildHitArea();
    this.setDirty();
  }
  public getTextContent(): string {
    return this.textContent;
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const fx = parseFloat(this.posX) + dx,
      fy = parseFloat(this.posY) + dy;
    this.posX = String(fx);
    this.posY = String(fy);
    this.buildHitArea();
  }
}
