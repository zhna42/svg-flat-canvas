import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { PolylineHitArea } from '../modules/HitArea';
import { flattenPointsTransform } from '@/spatial/geometry-utils';

export class PolylineElement extends AbstractGraphicElement {
  private _ha = new PolylineHitArea();

  public points = '';

  public constructor(id: string) {
    super(id, 'polyline');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    const raw = this.parsePoints(this.points);
    this._ha.set(raw, this.style.strokeWidth);
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
    return { points: this.points };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { points: this.points };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.points !== undefined) {
      this.points = data.points as string;
      this.markRenderKey('points');
    }
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    (clone as PolylineElement).points = this.points;
    clone.rebuildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const nums = this.points
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    for (let i = 0; i < nums.length; i += 2) {
      nums[i] += dx;
      if (i + 1 < nums.length) nums[i + 1] += dy;
    }
    this.points = nums.join(' ');
    this.markRenderKey('points');
    this.rebuildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const pts = this.parsePoints(this.points);
    const scaled = flattenPointsTransform(
      pts,
      this.getBBox(),
      this.getTransformedBBox(),
    );
    this.points = scaled.map((p) => `${p.x},${p.y}`).join(' ');
    this.markRenderKey('points');
    this.transform.reset();
    this.markRenderKey('matrix');
    this.rebuildHitArea();
    this.requestRender();
  }

  public toSegmentPolygons(): Point[][] {
    return [this.parsePoints(this.points)];
  }
}
