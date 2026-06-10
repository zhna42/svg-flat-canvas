import { SvgElement } from './SvgElement';
import type { Point } from '@/types';
import { MIN_HIT_STROKE_WIDTH } from '@/constants';

export class PolylineElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'polyline', 'polyline');
  }

  public buildHitArea(): void {
    const pointsAttr = this.element.getAttribute('points') || '';
    const rawPoints = this.parsePoints(pointsAttr);

    if (rawPoints.length < 2) return;

    const sw = Math.max(this.getStrokeWidth(), MIN_HIT_STROKE_WIDTH);
    const halfSw = sw / 2;
    const result: Point[] = [];

    for (let i = 0; i < rawPoints.length - 1; i++) {
      const p1 = rawPoints[i];
      const p2 = rawPoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len === 0) {
        result.push(
          { x: p1.x - halfSw, y: p1.y - halfSw },
          { x: p1.x + halfSw, y: p1.y - halfSw },
          { x: p1.x + halfSw, y: p1.y + halfSw },
          { x: p1.x - halfSw, y: p1.y + halfSw },
        );
        continue;
      }

      const nx = (-dy / len) * halfSw;
      const ny = (dx / len) * halfSw;

      if (i === 0) {
        result.push({ x: p1.x + nx, y: p1.y + ny });
      }
      result.push({ x: p2.x + nx, y: p2.y + ny });
    }

    for (let i = rawPoints.length - 1; i > 0; i--) {
      const p1 = rawPoints[i];
      const p2 = rawPoints[i - 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len === 0) {
        if (i === rawPoints.length - 1) {
          result.push({ x: p1.x - halfSw, y: p1.y + halfSw });
        }
        continue;
      }

      const nx = (-dy / len) * halfSw;
      const ny = (dx / len) * halfSw;

      result.push({ x: p1.x - nx, y: p1.y - ny });
    }

    this._hitArea = result;
  }

  public clone(): PolylineElement {
    const el = new PolylineElement(this.id);
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

  protected createClone(): PolylineElement {
    return new PolylineElement(this.id);
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
}
