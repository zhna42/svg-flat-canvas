import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { CircleHitArea } from '../modules/HitArea';

export class CircleElement extends AbstractGraphicElement {
  private _ha = new CircleHitArea();

  public geometry = { cx: 0, cy: 0, r: 0 };

  public constructor(id: string) {
    super(id, 'circle');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(this.geometry.cx, this.geometry.cy, this.geometry.r);
  }

  public getBBox(): BoundingBox {
    return {
      x: this.geometry.cx - this.geometry.r,
      y: this.geometry.cy - this.geometry.r,
      width: this.geometry.r * 2,
      height: this.geometry.r * 2,
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { ...this.geometry };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { ...this.geometry };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.cx !== undefined) { this.geometry.cx = data.cx as number; this.markRenderKey('cx'); }
    if (data.cy !== undefined) { this.geometry.cy = data.cy as number; this.markRenderKey('cy'); }
    if (data.r !== undefined) { this.geometry.r = data.r as number; this.markRenderKey('r'); }
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    (clone as CircleElement).geometry = { ...this.geometry };
    clone.buildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.geometry.cx += dx;
    this.geometry.cy += dy;
    this.markRenderKeys('cx', 'cy');
    this.buildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.geometry.cx = bbox.x + bbox.width / 2;
    this.geometry.cy = bbox.y + bbox.height / 2;
    this.geometry.r = Math.max(bbox.width, bbox.height) / 2;
    this.markRenderKeys('cx', 'cy', 'r');
    this.transform.reset();
    this.markRenderKey('matrix');
    this.buildHitArea();
    this.requestRender();
  }
}
