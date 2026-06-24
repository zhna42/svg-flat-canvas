import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitAreaSimple } from '../modules/HitArea';

export class ImageElement extends AbstractGraphicElement {
  private _ha = new RectHitAreaSimple();

  public geometry = { x: 0, y: 0, width: 0, height: 0 };
  public href = '';

  public constructor(id: string) {
    super(id, 'image');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    if (this.geometry.width <= 0 || this.geometry.height <= 0) return;
    this._ha.set([
      { x: this.geometry.x, y: this.geometry.y },
      { x: this.geometry.x + this.geometry.width, y: this.geometry.y },
      {
        x: this.geometry.x + this.geometry.width,
        y: this.geometry.y + this.geometry.height,
      },
      { x: this.geometry.x, y: this.geometry.y + this.geometry.height },
    ]);
  }

  public getBBox(): BoundingBox {
    return { ...this.geometry };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { ...this.geometry, href: this.href };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { ...this.geometry, href: this.href };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) { this.geometry.x = data.x as number; this.markRenderKey('x'); }
    if (data.y !== undefined) { this.geometry.y = data.y as number; this.markRenderKey('y'); }
    if (data.width !== undefined) { this.geometry.width = data.width as number; this.markRenderKey('width'); }
    if (data.height !== undefined) { this.geometry.height = data.height as number; this.markRenderKey('height'); }
    if (data.href !== undefined) { this.href = data.href as string; this.markRenderKey('href'); }
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as ImageElement;
    el.geometry = { ...this.geometry };
    el.href = this.href;
    el.buildHitArea();
  }

  public setHref(href: string): void {
    this.href = href;
    this.markRenderKey('href');
    this.requestRender();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.geometry.x += dx;
    this.geometry.y += dy;
    this.markRenderKeys('x', 'y');
    this.buildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.geometry.x = bbox.x;
    this.geometry.y = bbox.y;
    this.geometry.width = bbox.width;
    this.geometry.height = bbox.height;
    this.markRenderKeys('x', 'y', 'width', 'height');
    this.transform.reset();
    this.markRenderKey('matrix');
    this.buildHitArea();
    this.requestRender();
  }

  public toSegmentPolygons(): Point[][] {
    const { x, y, width, height } = this.geometry;
    return [[
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ]];
  }
}
