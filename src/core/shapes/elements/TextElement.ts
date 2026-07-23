import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/core/type';
import { RectHitAreaSimple } from '../modules/HitArea';

export interface TextChunk {
  text: string;
  color: string;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  fontFamily: string;
  fontSize: number;
  underline: boolean;
  strike: boolean;
  letterSpacing: number;
}

export class TextElement extends AbstractGraphicElement {
  _ha = new RectHitAreaSimple();

  public textModel: TextChunk[] = [];
  public boxX = 0;
  public boxY = 0;
  public boxWidth = 100;
  public boxHeight = 40;
  public align: 'left' | 'center' | 'right' = 'left';
  public lineHeight = 1.2;

  public caretIdx = -1;
  public selStart = -1;
  public selEnd = -1;
  public editing = false;

  public constructor(id: string) {
    super(id, 'text');
    this.subscribeGeometry(
      'textModel',
      'boxX',
      'boxY',
      'boxWidth',
      'boxHeight',
      'align',
      'lineHeight',
      'caretIdx',
      'selStart',
      'selEnd',
      'editing',
    );
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set([
      { x: this.boxX, y: this.boxY },
      { x: this.boxX + this.boxWidth, y: this.boxY },
      { x: this.boxX + this.boxWidth, y: this.boxY + this.boxHeight },
      { x: this.boxX, y: this.boxY + this.boxHeight },
    ]);
  }

  public getBBox(): BoundingBox {
    return {
      x: this.boxX,
      y: this.boxY,
      width: Math.max(this.boxWidth, 1),
      height: Math.max(this.boxHeight, 1),
    };
  }

  public get fullText(): string {
    return this.textModel.map((c) => c.text).join('');
  }

  public get defaultStyle(): Omit<TextChunk, 'text'> {
    if (this.textModel.length > 0) {
      const {
        color,
        fontWeight,
        fontStyle,
        fontFamily,
        fontSize,
        underline,
        strike,
        letterSpacing,
      } = this.textModel[0];
      return {
        color,
        fontWeight,
        fontStyle,
        fontFamily,
        fontSize,
        underline,
        strike,
        letterSpacing,
      };
    }
    return {
      color: '#000000',
      fontWeight: '400',
      fontStyle: 'normal',
      fontFamily: 'Roboto',
      fontSize: 4,
      underline: false,
      strike: false,
      letterSpacing: 0,
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      _model: JSON.stringify(this.textModel),
      _boxX: String(this.boxX),
      _boxY: String(this.boxY),
      _boxWidth: String(this.boxWidth),
      _boxHeight: String(this.boxHeight),
      _align: this.align,
      _lineHeight: String(this.lineHeight),
      _isPreview: this.isPreview ? '1' : '',
      _caretIdx: String(this.caretIdx),
      _selStart: String(this.selStart),
      _selEnd: String(this.selEnd),
      _editing: this.editing ? '1' : '',
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      textModel: JSON.stringify(this.textModel),
      boxX: this.boxX,
      boxY: this.boxY,
      boxWidth: this.boxWidth,
      boxHeight: this.boxHeight,
      align: this.align,
      lineHeight: this.lineHeight,
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (typeof data.textModel === 'string') {
      try {
        this.textModel = JSON.parse(data.textModel);
      } catch {
        this.textModel = [];
      }
    }
    if (typeof data.boxX === 'number') this.boxX = data.boxX;
    if (typeof data.boxY === 'number') this.boxY = data.boxY;
    if (typeof data.boxWidth === 'number') this.boxWidth = data.boxWidth;
    if (typeof data.boxHeight === 'number') this.boxHeight = data.boxHeight;
    if (typeof data.align === 'string')
      this.align = data.align as TextElement['align'];
    if (typeof data.lineHeight === 'number') this.lineHeight = data.lineHeight;
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as TextElement;
    el.textModel = this.textModel.map((c) => ({ ...c }));
    el.boxX = this.boxX;
    el.boxY = this.boxY;
    el.boxWidth = this.boxWidth;
    el.boxHeight = this.boxHeight;
    el.align = this.align;
    el.lineHeight = this.lineHeight;
    el.rebuildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.boxX += dx;
    this.boxY += dy;
    this.rebuildHitArea();
  }

  public toOutlinePath(): import('./PathElement').PathElement {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PathElement: PE } = require('./PathElement');
    return new PE(`${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    return [];
  }
}
