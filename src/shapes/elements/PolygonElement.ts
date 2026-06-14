import { SvgElement } from './SvgElement';
import type { Point } from '@/types';
import { MIN_HIT_STROKE_WIDTH } from '@/constants';

export class PolygonElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'polygon', 'polygon');
  }

  public buildHitArea(): void {
    const pointsAttr = this.element.getAttribute('points') || '';
    const rawPoints = this.parsePoints(pointsAttr);

    if (rawPoints.length < 3) return;

    if (!this.hasFill()) {
      const sw = Math.max(this.getStrokeWidth(), MIN_HIT_STROKE_WIDTH);
      this._hitArea = this.offsetPolygon(rawPoints, sw / 2);
      return;
    }

    this._hitArea = rawPoints;
  }

  public clone(): PolygonElement {
    const el = new PolygonElement(this.id);
    [
      'points',
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

  protected createClone(): PolygonElement {
    return new PolygonElement(this.id);
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const pointsAttr = this.element.getAttribute('points') || '';
    const nums = pointsAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    for (let i = 0; i < nums.length; i += 2) {
      nums[i] += dx;
      if (i + 1 < nums.length) nums[i + 1] += dy;
    }
    const str = nums.join(' ');
    this.element.setAttribute('points', str);
  }

  private parsePoints(points: string): Point[] {
    const nums = points
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));

    const result: Point[] = [];
    for (let i = 0; i < nums.length - 1; i += 2) {
      result.push({ x: nums[i], y: nums[i + 1] });
    }
    return result;
  }

  private offsetPolygon(poly: Point[], offset: number): Point[] {
    if (poly.length < 3) return poly;

    const result: Point[] = [];
    const n = poly.length;

    for (let i = 0; i < n; i++) {
      const prev = poly[(i - 1 + n) % n];
      const curr = poly[i];
      const next = poly[(i + 1) % n];

      const e1x = curr.x - prev.x;
      const e1y = curr.y - prev.y;
      const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
      const n1x = len1 > 0 ? -e1y / len1 : 0;
      const n1y = len1 > 0 ? e1x / len1 : 0;

      const e2x = next.x - curr.x;
      const e2y = next.y - curr.y;
      const len2 = Math.sqrt(e2x * e2x + e2y * e2y);
      const n2x = len2 > 0 ? -e2y / len2 : 0;
      const n2y = len2 > 0 ? e2x / len2 : 0;

      const bisX = n1x + n2x;
      const bisY = n1y + n2y;
      const bisLen = Math.sqrt(bisX * bisX + bisY * bisY);
      const scale = bisLen > 0 ? offset / bisLen : offset;

      result.push({
        x: curr.x + bisX * scale,
        y: curr.y + bisY * scale,
      });
    }

    return result;
  }
}
