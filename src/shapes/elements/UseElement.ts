import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import type { PathElement } from './PathElement';

export class UseElement extends AbstractGraphicElement {
  public refId = '';
  public x = 0;
  public y = 0;
  _parentElement: AbstractGraphicElement | null = null;
  _parentSub: (() => void) | null = null;

  public constructor(id: string) {
    super(id, 'use');
  }

  public get hitArea(): Point[] {
    if (!this._parentElement) return [];
    return this._parentElement.getWorldHitPoints();
  }

  public buildHitArea(): void {
    this.onGeometryChanged?.(this);
  }

  public getBBox(): BoundingBox {
    if (!this._parentElement) return { x: 0, y: 0, width: 0, height: 0 };
    return this._parentElement.getTransformedBBox();
  }

  public override getWorldHitPoints(): Point[] {
    const ha = this.hitArea;
    if (ha.length === 0) return [];
    return ha.map((p) => this.transformPoint(p));
  }

  public override getTransformedBBox(): BoundingBox {
    const bbox = this.getBBox();
    if (bbox.width === 0 && bbox.height === 0)
      return { x: 0, y: 0, width: 0, height: 0 };

    const corners: Point[] = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height },
    ];

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of corners) {
      const tp = this.transformPoint(c);
      if (tp.x < minX) minX = tp.x;
      if (tp.y < minY) minY = tp.y;
      if (tp.x > maxX) maxX = tp.x;
      if (tp.y > maxY) maxY = tp.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  public override getWorldCorners(): Point[] {
    const bbox = this.getBBox();
    return [
      this.transformPoint({ x: bbox.x, y: bbox.y }),
      this.transformPoint({ x: bbox.x + bbox.width, y: bbox.y }),
      this.transformPoint({
        x: bbox.x + bbox.width,
        y: bbox.y + bbox.height,
      }),
      this.transformPoint({ x: bbox.x, y: bbox.y + bbox.height }),
    ];
  }

  public override getCenter(): Point {
    const bbox = this.getTransformedBBox();
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  public bindToParent(parent: AbstractGraphicElement): void {
    this.unbindParent();
    this._parentElement = parent;
    this.refId = parent.id;

    const trigger = (): void => {
      this.buildHitArea();
    };

    this._parentSub = parent.subscribe(
      ['transform.matrix', 'style.fill', 'style.stroke', 'style.strokeWidth'],
      trigger,
    );
  }

  public unbindParent(): void {
    if (this._parentSub) {
      this._parentSub();
      this._parentSub = null;
    }
  }

  public unobind(): AbstractGraphicElement | null {
    const useTransform = this.transform.matrix;
    this.unbindParent();
    if (!this._parentElement) return null;

    const clone = this._parentElement.clone();
    clone.id = crypto.randomUUID();
    clone.name = this.name;
    clone.groupId = this.groupId;
    clone.data = { ...this.data };
    clone.setVisible(this.visible);
    clone.lock = this.lock;

    clone.transform.matrix.e += useTransform.e;
    clone.transform.matrix.f += useTransform.f;

    clone.rebuildHitArea();
    clone.clearTimeMachineDiff();
    return clone;
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      href: `#${this.refId}`,
      x: 0,
      y: 0,
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return { refId: this.refId, x: this.x, y: this.y };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.refId !== undefined) this.refId = data.refId as string;
    if (data.x !== undefined) this.x = data.x as number;
    if (data.y !== undefined) this.y = data.y as number;
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const c = clone as UseElement;
    c.refId = this.refId;
    c.x = this.x;
    c.y = this.y;
    c._parentElement = this._parentElement;
    c.rebuildHitArea();
  }

  public toSegmentPolygons(): Point[][] {
    const ha = this.getWorldHitPoints();
    return ha.length > 0 ? [ha] : [];
  }

  public toOutlinePath(): PathElement {
    return this._parentElement?.toOutlinePath() ?? ({} as PathElement);
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      refId: this.refId,
      x: this.x,
      y: this.y,
    };
  }

  public override toSnapshot(): Record<string, unknown> {
    return {
      ...super.toSnapshot(),
      refId: this.refId,
      x: this.x,
      y: this.y,
    };
  }

  public override toDTO(): Record<string, unknown> {
    return {
      ...super.toDTO(),
      refId: this.refId,
      x: this.x,
      y: this.y,
    };
  }

  public override clone(): AbstractGraphicElement {
    const cloned = new UseElement(this.id);
    cloned.groupId = this.groupId;
    cloned.laserProps.laserGroupId = this.laserProps.laserGroupId;
    cloned.laserProps.laserType = this.laserProps.laserType;
    cloned.name = this.name;
    cloned.setVisible(this.visible);
    cloned.lock = this.lock;
    cloned.data = { ...this.data };
    cloned.style.fill = this.style.fill;
    cloned.style.stroke = this.style.stroke;
    cloned.style.strokeWidth = this.style.strokeWidth;
    cloned.style.opacity = this.style.opacity;
    cloned.style.visible = this.style.visible;
    cloned.transform.matrix = new DOMMatrix(this.transform.matrix.toString());
    cloned.refId = this.refId;
    cloned.x = this.x;
    cloned.y = this.y;
    cloned._parentElement = this._parentElement;
    cloned.rebuildHitArea();
    return cloned;
  }
}
