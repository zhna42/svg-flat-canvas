import { SvgElement } from './SvgElement';
import type { Point, BoundingBox } from '@/types';
import { PolygonHitArea } from '../modules/HitArea';
import { flattenPointsTransform } from '../modules/geometry-utils';

export class PolygonElement extends SvgElement {
  private _ha = new PolygonHitArea();

  public constructor(id: string) {
    super(id, 'polygon', 'polygon');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    const raw = this.parsePoints(this.element.getAttribute('points') || '');
    this._ha.set(raw, this.style.strokeWidth, this.style.hasFill);
  }

  public getBBox(): BoundingBox {
    const pts = this.hitArea;
    if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { points: this.element.getAttribute('points') || '' };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return { points: this.element.getAttribute('points') || '' };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.points !== undefined)
      this.element.setAttribute('points', data.points as string);
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as PolygonElement;
    [
      'points',
      'fill',
      'stroke',
      'stroke-width',
      'opacity',
      'transform',
    ].forEach((a) => {
      const v = this.element.getAttribute(a);
      if (v !== null) el.element.setAttribute(a, v);
    });
    el.buildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const nums = (this.element.getAttribute('points') || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    for (let i = 0; i < nums.length; i += 2) {
      nums[i] += dx;
      if (i + 1 < nums.length) nums[i + 1] += dy;
    }
    this.element.setAttribute('points', nums.join(' '));
    this.buildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const pts = this.parsePoints(this.element.getAttribute('points') || '');
    const scaled = flattenPointsTransform(
      pts,
      this.getBBox(),
      this.getTransformedBBox(),
    );
    this.element.setAttribute(
      'points',
      scaled.map((p) => `${p.x},${p.y}`).join(' '),
    );
    this.transform.reset();
    this.matrix = this.transform.matrix;
    this.element.removeAttribute('transform');
    this.invalidateHitArea();
  }
}
