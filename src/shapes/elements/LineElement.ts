import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { LineHitArea } from '../modules/HitArea';

export class LineElement extends AbstractGraphicElement {
  _ha = new LineHitArea();

  public geometry = { x1: 0, y1: 0, x2: 0, y2: 0 };

  public constructor(id: string) {
    super(id, 'line');
    this.subscribeGeometry(
      'geometry.x1',
      'geometry.y1',
      'geometry.x2',
      'geometry.y2',
    );
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    this._ha.set(
      this.geometry.x1,
      this.geometry.y1,
      this.geometry.x2,
      this.geometry.y2,
      this.style.strokeWidth,
    );
  }

  public getBBox(): BoundingBox {
    return {
      x: Math.min(this.geometry.x1, this.geometry.x2),
      y: Math.min(this.geometry.y1, this.geometry.y2),
      width: Math.abs(this.geometry.x2 - this.geometry.x1),
      height: Math.abs(this.geometry.y2 - this.geometry.y1),
    };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { ...this.geometry };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { ...this.geometry };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x1 !== undefined) this.geometry.x1 = data.x1 as number;
    if (data.y1 !== undefined) this.geometry.y1 = data.y1 as number;
    if (data.x2 !== undefined) this.geometry.x2 = data.x2 as number;
    if (data.y2 !== undefined) this.geometry.y2 = data.y2 as number;
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    (clone as LineElement).geometry = { ...this.geometry };
    clone.rebuildHitArea();
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.geometry.x1 += dx;
    this.geometry.y1 += dy;
    this.geometry.x2 += dx;
    this.geometry.y2 += dy;
    this.rebuildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    const cx = (this.geometry.x1 + this.geometry.x2) / 2,
      cy = (this.geometry.y1 + this.geometry.y2) / 2;
    const halfDx = (this.geometry.x2 - this.geometry.x1) / 2,
      halfDy = (this.geometry.y2 - this.geometry.y1) / 2;
    const s = Math.max(
      bbox.width / (Math.abs(halfDx) * 2 || 1),
      bbox.height / (Math.abs(halfDy) * 2 || 1),
    );
    this.geometry.x1 = cx - halfDx * s;
    this.geometry.y1 = cy - halfDy * s;
    this.geometry.x2 = cx + halfDx * s;
    this.geometry.y2 = cy + halfDy * s;
    this.transform.reset();
    this.rebuildHitArea();
  }

  public toOutlinePath(): import('./PathElement').PathElement {
    const { svgStringToOutlinePath } = require('./svg-outline-utils');
    const { x1, y1, x2, y2 } = this.geometry;
    const svgStr = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${this.style.stroke}" stroke-width="${this.style.strokeWidth}"/>`;
    return svgStringToOutlinePath(svgStr, `${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    return [
      [
        { x: this.geometry.x1, y: this.geometry.y1 },
        { x: this.geometry.x2, y: this.geometry.y2 },
      ],
    ];
  }
}
