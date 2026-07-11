import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/core/type';
import { RectHitAreaSimple } from '../modules/HitArea';

export class TextElement extends AbstractGraphicElement {
  _ha = new RectHitAreaSimple();

  // Общие / legacy (<text>) поля
  public posX = '0';
  public posY = '0';
  public fontSize = '16';
  public fontFamily = '';
  public textAnchor = 'start';
  public textContent = '';

  // Rich (foreignObject) модель
  public rich = false;
  public boxWidth = '0';
  public boxHeight = '0';
  public color = '#000000';
  public fontWeight = '400';
  public italic = false;
  public underline = false;
  public strike = false;
  public align = 'left';
  public lineHeight = '1.2';

  public constructor(id: string) {
    super(id, 'text');
    this.subscribeGeometry(
      'posX',
      'posY',
      'fontSize',
      'fontFamily',
      'textAnchor',
      'textContent',
      'rich',
      'boxWidth',
      'boxHeight',
      'color',
      'fontWeight',
      'italic',
      'underline',
      'strike',
      'align',
      'lineHeight',
    );
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    const bbox = this.getBBox();
    this._ha.set([
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height },
    ]);
  }

  public getBBox(): BoundingBox {
    if (this.rich) {
      return {
        x: parseFloat(this.posX),
        y: parseFloat(this.posY),
        width: Math.max(parseFloat(this.boxWidth), 1),
        height: Math.max(parseFloat(this.boxHeight), 1),
      };
    }
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

  /** Перевести legacy <text> в rich-модель (box + html), сохранив стиль. */
  public convertToRich(box: BoundingBox): void {
    const size = parseFloat(this.fontSize) || 16;
    this.rich = true;
    this.posX = String(box.x);
    this.posY = String(box.y);
    this.boxWidth = String(Math.max(box.width, size));
    this.boxHeight = String(Math.max(box.height, size * 1.4));
    this.align =
      this.textAnchor === 'middle'
        ? 'center'
        : this.textAnchor === 'end'
          ? 'right'
          : 'left';
    if (this.textContent && !/[<>]/.test(this.textContent)) {
      this.textContent = escapeBasic(this.textContent);
    }
    this.rebuildHitArea();
  }

  protected getGeometryProps(): Record<string, unknown> {
    if (this.rich) {
      return {
        _rich: '1',
        x: this.posX,
        y: this.posY,
        width: this.boxWidth,
        height: this.boxHeight,
        _content: this.textContent,
        _fontFamily: this.fontFamily,
        _fontSize: this.fontSize,
        _color: this.color,
        _fontWeight: this.fontWeight,
        _italic: this.italic ? '1' : '',
        _underline: this.underline ? '1' : '',
        _strike: this.strike ? '1' : '',
        _align: this.align,
        _lineHeight: this.lineHeight,
      };
    }
    return {
      _rich: '',
      x: this.posX,
      y: this.posY,
      'font-size': this.fontSize,
      'font-family': this.fontFamily,
      'text-anchor': this.textAnchor,
      _content: this.textContent,
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      rich: this.rich,
      x: this.posX,
      y: this.posY,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      textAnchor: this.textAnchor,
      textContent: this.textContent,
      boxWidth: this.boxWidth,
      boxHeight: this.boxHeight,
      color: this.color,
      fontWeight: this.fontWeight,
      italic: this.italic,
      underline: this.underline,
      strike: this.strike,
      align: this.align,
      lineHeight: this.lineHeight,
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    const s = data as Record<string, unknown>;
    if (s.rich !== undefined) this.rich = s.rich as boolean;
    if (s.x !== undefined) this.posX = s.x as string;
    if (s.y !== undefined) this.posY = s.y as string;
    if (s.fontSize !== undefined) this.fontSize = s.fontSize as string;
    if (s.fontFamily !== undefined) this.fontFamily = s.fontFamily as string;
    if (s.textAnchor !== undefined) this.textAnchor = s.textAnchor as string;
    if (s.textContent !== undefined) this.textContent = s.textContent as string;
    if (s.boxWidth !== undefined) this.boxWidth = s.boxWidth as string;
    if (s.boxHeight !== undefined) this.boxHeight = s.boxHeight as string;
    if (s.color !== undefined) this.color = s.color as string;
    if (s.fontWeight !== undefined) this.fontWeight = s.fontWeight as string;
    if (s.italic !== undefined) this.italic = s.italic as boolean;
    if (s.underline !== undefined) this.underline = s.underline as boolean;
    if (s.strike !== undefined) this.strike = s.strike as boolean;
    if (s.align !== undefined) this.align = s.align as string;
    if (s.lineHeight !== undefined) this.lineHeight = s.lineHeight as string;
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as TextElement;
    el.rich = this.rich;
    el.posX = this.posX;
    el.posY = this.posY;
    el.fontSize = this.fontSize;
    el.fontFamily = this.fontFamily;
    el.textAnchor = this.textAnchor;
    el.textContent = this.textContent;
    el.boxWidth = this.boxWidth;
    el.boxHeight = this.boxHeight;
    el.color = this.color;
    el.fontWeight = this.fontWeight;
    el.italic = this.italic;
    el.underline = this.underline;
    el.strike = this.strike;
    el.align = this.align;
    el.lineHeight = this.lineHeight;
    el.rebuildHitArea();
  }

  public setTextContent(text: string): void {
    this.textContent = text;
    this.rebuildHitArea();
  }
  public getTextContent(): string {
    return this.textContent;
  }
  public setBox(width: number, height: number): void {
    this.boxWidth = String(Math.max(width, 1));
    this.boxHeight = String(Math.max(height, 1));
    this.rebuildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.posX = String(parseFloat(this.posX) + dx);
    this.posY = String(parseFloat(this.posY) + dy);
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

function escapeBasic(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
