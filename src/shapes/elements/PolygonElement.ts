import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox, EditNodeModel, INodeEditable } from '@/types';
import { PolygonHitArea } from '../modules/HitArea';
import { flattenPointsTransform } from '@/math/geometry-utils';
import { nextNodeId } from '@/shapes/path/node-model-utils';

export class PolygonElement
  extends AbstractGraphicElement
  implements INodeEditable
{
  _ha = new PolygonHitArea();
  public readonly supportsCurves = false;

  public points = '';

  public constructor(id: string) {
    super(id, 'polygon');
    this.subscribeGeometry('points');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    const raw = this.parsePoints(this.points);
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
    return { points: this.points };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { points: this.points };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.points !== undefined) this.points = data.points as string;
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    (clone as PolygonElement).points = this.points;
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
    this.transform.reset();
    this.rebuildHitArea();
  }

  public toOutlinePath(): import('./PathElement').PathElement {
    const { svgStringToOutlinePath } = require('./svg-outline-utils');
    const fill = this.style.hasFill
      ? `fill="${this.style.fill}"`
      : 'fill="none"';
    const svgStr = `<polygon points="${this.points}" ${fill} stroke="${this.style.stroke}" stroke-width="${this.style.strokeWidth}"/>`;
    return svgStringToOutlinePath(svgStr, `${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    return [this.parsePoints(this.points)];
  }

  public toEditModel(): EditNodeModel {
    const m = this.transform.matrix;
    const nodes = this.parsePoints(this.points).map((p) => {
      const tp = m.transformPoint(new DOMPoint(p.x, p.y));
      return {
        id: nextNodeId(),
        anchor: { x: tp.x, y: tp.y },
        type: 'corner' as const,
      };
    });
    return {
      elementId: this.id,
      elementType: this.type,
      contours: [{ nodes, closed: true }],
    };
  }

  public applyEditModel(model: EditNodeModel): void {
    const inv = this.transform.matrix.inverse();
    const parts: string[] = [];
    for (const c of model.contours) {
      for (const n of c.nodes) {
        const tp = inv.transformPoint(new DOMPoint(n.anchor.x, n.anchor.y));
        parts.push(`${tp.x},${tp.y}`);
      }
    }
    this.points = parts.join(' ');
    this.rebuildHitArea();
  }
}
