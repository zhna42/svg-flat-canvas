import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitArea } from '../modules/HitArea';

export class RectElement extends AbstractGraphicElement {
  private _ha = new RectHitArea();

  public geometry = { x: 0, y: 0, width: 0, height: 0, rx: 0, ry: 0 };

  public constructor(id: string) {
    super(id, 'rect');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(
      this.geometry.x,
      this.geometry.y,
      this.geometry.width,
      this.geometry.height,
      this.geometry.rx,
      this.geometry.ry,
      this.style.strokeWidth,
      this.style.hasFill,
    );
  }

  public getBBox(): BoundingBox {
    return {
      x: this.geometry.x,
      y: this.geometry.y,
      width: this.geometry.width,
      height: this.geometry.height,
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { ...this.geometry };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { ...this.geometry };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) this.geometry.x = data.x as number;
    if (data.y !== undefined) this.geometry.y = data.y as number;
    if (data.width !== undefined) this.geometry.width = data.width as number;
    if (data.height !== undefined) this.geometry.height = data.height as number;
    if (data.rx !== undefined) this.geometry.rx = data.rx as number;
    if (data.ry !== undefined) this.geometry.ry = data.ry as number;
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as RectElement;
    el.geometry = { ...this.geometry };
    el.buildHitArea();
  }

  public setX(x: number): void {
    this.geometry.x = x;
    this.buildHitArea();
    this.setDirtyGeometry();
  }
  public setY(y: number): void {
    this.geometry.y = y;
    this.buildHitArea();
    this.setDirtyGeometry();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.geometry.x += dx;
    this.geometry.y += dy;
    this.buildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.geometry.x = bbox.x;
    this.geometry.y = bbox.y;
    this.geometry.width = bbox.width;
    this.geometry.height = bbox.height;
    this.transform.reset();
    this.invalidateHitArea();
  }
}
