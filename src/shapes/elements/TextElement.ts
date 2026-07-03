import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitAreaSimple } from '../modules/HitArea';

export class TextElement extends AbstractGraphicElement {
  _ha = new RectHitAreaSimple();

  public posX = '0';
  public posY = '0';
  public fontSize = '16';
  public fontFamily = '';
  public textAnchor = 'start';
  public textContent = '';

  public constructor(id: string) {
    super(id, 'text');
    this.subscribeGeometry(
      'posX',
      'posY',
      'fontSize',
      'fontFamily',
      'textAnchor',
      'textContent',
    );
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
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as TextElement;
    el.posX = this.posX;
    el.posY = this.posY;
    el.fontSize = this.fontSize;
    el.fontFamily = this.fontFamily;
    el.textAnchor = this.textAnchor;
    el.textContent = this.textContent;
    el.rebuildHitArea();
  }

  public setTextContent(text: string): void {
    this.textContent = text;
    this.rebuildHitArea();
  }
  public getTextContent(): string {
    return this.textContent;
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const fx = parseFloat(this.posX) + dx,
      fy = parseFloat(this.posY) + dy;
    this.posX = String(fx);
    this.posY = String(fy);
    this.rebuildHitArea();
  }

  public toOutlinePath(): import('./PathElement').PathElement {
    const { PathElement: PE } = require('./PathElement');
    return new PE(`${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    return [];
  }
}
