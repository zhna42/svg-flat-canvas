import { SvgElement } from './SvgElement';
import type { Point } from '@/types';
import { MAX_HIT_POINTS, MIN_HIT_STROKE_WIDTH } from '@/constants';

export class RectElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'rect', 'rect');
  }

  public buildHitArea(): void {
    const x = this.getAttrAsNum('x', 0);
    const y = this.getAttrAsNum('y', 0);
    const w = this.getAttrAsNum('width', 0);
    const h = this.getAttrAsNum('height', 0);
    const rx = this.getAttrAsNum('rx', 0);
    const ry = this.getAttrAsNum('ry', 0);

    if (w <= 0 || h <= 0) return;

    if (!this.hasFill() || rx > 0 || ry > 0) {
      this._hitArea = this.buildRoundedRectHitArea(x, y, w, h, rx, ry);
      return;
    }

    this._hitArea = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }

  private buildRoundedRectHitArea(
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
  ): Point[] {
    const rX = Math.min(rx || ry, w / 2);
    const rY = Math.min(ry || rx, h / 2);
    const sw = this.hasFill()
      ? 0
      : Math.max(this.getStrokeWidth(), MIN_HIT_STROKE_WIDTH);
    const offset = sw / 2;

    const pts = this.approximateArc(rX + offset, rY + offset, MAX_HIT_POINTS);
    const n = pts.length;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const innerW = w / 2 - rX;
    const innerH = h / 2 - rY;

    const result: Point[] = [];

    for (let i = 0; i < n; i++) {
      result.push({
        x: cx + pts[i].x + innerW,
        y: cy + pts[i].y + innerH,
      });
    }
    for (let i = 0; i < n; i++) {
      result.push({
        x: cx - pts[n - 1 - i].x - innerW,
        y: cy + pts[n - 1 - i].y + innerH,
      });
    }
    for (let i = 0; i < n; i++) {
      result.push({
        x: cx - pts[i].x - innerW,
        y: cy - pts[i].y - innerH,
      });
    }
    for (let i = 0; i < n; i++) {
      result.push({
        x: cx + pts[n - 1 - i].x + innerW,
        y: cy - pts[n - 1 - i].y - innerH,
      });
    }

    return result;
  }

  private approximateArc(rx: number, ry: number, segments: number): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (Math.PI / 2 / segments) * i;
      pts.push({ x: rx * Math.cos(angle), y: ry * Math.sin(angle) });
    }
    return pts;
  }

  public clone(): RectElement {
    const el = new RectElement(this.id);
    [
      'x',
      'y',
      'width',
      'height',
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

  protected createClone(): RectElement {
    return new RectElement(this.id);
  }

  private getAttrAsNum(name: string, fallback: number): number {
    const v = this.element.getAttribute(name);
    return v !== null ? parseFloat(v) : fallback;
  }
}
