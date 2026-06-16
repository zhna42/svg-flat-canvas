import type { Point, BoundingBox, ElementType } from '@/types';
import { Transform } from '../modules/Transform';
import { Style } from '../modules/Style';
import { getRenderQueue } from '@/utils/render-queue-utils';

export interface RenderSnapshot {
  id: string;
  type: ElementType;
  visible: boolean;
  matrix: number[];
  style: Record<string, unknown>;
  geometry: Record<string, unknown>;
}

export abstract class AbstractGraphicElement {
  public readonly id: string;
  public readonly type: ElementType;
  public readonly transform = new Transform();
  public readonly style = new Style();

  public groupId = '';
  public laserGroupId = '';
  public laserType = '';
  public name: string;
  public visible = true;
  public lock = false;
  public isPreview = false;
  public isNodeEditing = false;
  public data: Record<string, unknown> = {};
  public onDirty: (() => void) | null = null;

  protected _dirty = false;

  public constructor(id: string, type: ElementType) {
    this.id = id;
    this.type = type;
    this.name = type;
  }

  public get dirty(): boolean {
    return this._dirty;
  }

  public markClean(): void {
    this._dirty = false;
  }

  public setDirty(): void {
    this._dirty = true;
    getRenderQueue()?.add(this);
    this.onDirty?.();
  }

  public abstract get hitArea(): Point[];

  public abstract buildHitArea(): void;

  public invalidateHitArea(): void {
    this.buildHitArea();
    this.setDirty();
  }

  public abstract getBBox(): BoundingBox;

  public getVisualBBox(): BoundingBox {
    const bbox = this.getBBox();
    const halfSw = this.style.strokeWidth / 2;
    if (halfSw <= 0) return bbox;
    return {
      x: bbox.x - halfSw,
      y: bbox.y - halfSw,
      width: bbox.width + halfSw * 2,
      height: bbox.height + halfSw * 2,
    };
  }

  public getWorldBBox(): BoundingBox {
    const corners = this.getWorldCorners();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of corners) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  public getWorldCorners(): Point[] {
    const local = this.getVisualBBox();
    return [
      this.transformPoint({ x: local.x, y: local.y }),
      this.transformPoint({ x: local.x + local.width, y: local.y }),
      this.transformPoint({
        x: local.x + local.width,
        y: local.y + local.height,
      }),
      this.transformPoint({ x: local.x, y: local.y + local.height }),
    ];
  }

  public getWorldHitPoints(): Point[] {
    const ha = this.hitArea;
    if (ha.length === 0) return [];
    return ha.map((p) => this.transformPoint(p));
  }

  public applyTransformation(
    type: string,
    delta: Record<string, number>,
    baseMatrix?: DOMMatrix,
  ): void {
    if (this.lock) return;
    const startingMatrix = baseMatrix
      ? new DOMMatrix(baseMatrix.toString())
      : this.transform.matrix;

    switch (type) {
      case 'translate':
        this.transform.applyTranslate(
          delta.x ?? 0,
          delta.y ?? 0,
          this.transform.angle,
        );
        break;
      case 'rotate': {
        const localCenter = this.getLocalCenter();
        this.transform.applyRotate(
          delta.angle ?? 0,
          localCenter,
          startingMatrix,
        );
        break;
      }
      case 'scale':
        this.transform.applyScale(delta, startingMatrix);
        break;
      default:
        return;
    }

    this.invalidateHitArea();
  }

  public transformPoint(p: Point): Point {
    return this.transform.transformPoint(p);
  }

  public getLocalCenter(): Point {
    const bbox = this.getVisualBBox();
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  public getTransformedBBox(): BoundingBox {
    const pts = this.hitArea;
    if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      const tp = this.transformPoint(p);
      if (tp.x < minX) minX = tp.x;
      if (tp.y < minY) minY = tp.y;
      if (tp.x > maxX) maxX = tp.x;
      if (tp.y > maxY) maxY = tp.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  public getCenter(): Point {
    const bbox = this.getTransformedBBox();
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  public translate(dx: number, dy: number): void {
    this.applyTransformation('translate', { x: dx, y: dy });
  }

  public applyDelta(dx: number, dy: number): void {
    this.translate(dx, dy);
  }

  public rotate(angle: number): void {
    this.applyTransformation('rotate', { angle });
  }

  public setFill(color: string): void {
    this.style.fill = color;
    this.invalidateHitArea();
  }

  public setStroke(color: string): void {
    this.style.stroke = color;
    this.invalidateHitArea();
  }

  public setStrokeWidth(w: number): void {
    this.style.strokeWidth = w;
    this.invalidateHitArea();
  }

  public setOpacity(v: number): void {
    this.style.opacity = v;
    this.setDirty();
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.style.visible = v;
    this.setDirty();
  }

  public setLock(v: boolean): void {
    this.lock = v;
  }

  public setName(v: string): void {
    this.name = v;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      groupId: this.groupId,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      data: this.data,
    };
  }

  public toSnapshot(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      groupId: this.groupId,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      data: { ...this.data },
      fill: this.style.fill,
      stroke: this.style.stroke,
      strokeWidth: this.style.strokeWidth,
      opacity: this.style.opacity,
      matrix: this.transform.matrix.toString(),
      ...this.getGeometrySnapshot(),
    };
  }

  public fromSnapshot(data: Record<string, unknown>): void {
    this.applyCommonSnapshot(data);
    this.applyGeometrySnapshot(data);
    this.invalidateHitArea();
  }

  protected applyCommonSnapshot(data: Record<string, unknown>): void {
    if (typeof data.groupId === 'string') this.groupId = data.groupId;
    if (typeof data.name === 'string') this.name = data.name;
    if (typeof data.visible === 'boolean') {
      this.visible = data.visible;
      this.style.visible = data.visible;
    }
    if (typeof data.lock === 'boolean') this.lock = data.lock;
    if (data.data && typeof data.data === 'object')
      this.data = { ...(data.data as Record<string, unknown>) };
    if (typeof data.fill === 'string') this.style.fill = data.fill;
    if (typeof data.stroke === 'string') this.style.stroke = data.stroke;
    if (typeof data.strokeWidth === 'number')
      this.style.strokeWidth = data.strokeWidth;
    if (typeof data.opacity === 'number') this.style.opacity = data.opacity;
    if (typeof data.matrix === 'string') {
      this.transform.matrix = new DOMMatrix(data.matrix);
    } else {
      this.transform.reset();
    }
  }

  public clone(): AbstractGraphicElement {
    const Cls = this.constructor as new (id: string) => AbstractGraphicElement;
    const cloned = new Cls(this.id);
    cloned.groupId = this.groupId;
    cloned.laserGroupId = this.laserGroupId;
    cloned.laserType = this.laserType;
    cloned.name = this.name;
    cloned.visible = this.visible;
    cloned.lock = this.lock;
    cloned.data = { ...this.data };
    cloned.style.fill = this.style.fill;
    cloned.style.stroke = this.style.stroke;
    cloned.style.strokeWidth = this.style.strokeWidth;
    cloned.style.opacity = this.style.opacity;
    cloned.style.visible = this.style.visible;
    cloned.transform.matrix = new DOMMatrix(this.transform.matrix.toString());
    this.copyGeometryTo(cloned);
    return cloned;
  }

  public applyDTO(dto: Record<string, unknown>): void {
    const geometry = dto as Record<string, unknown>;
    this.applyCommonSnapshot(geometry);
    this.applyGeometrySnapshot(geometry);
  }

  public toDTO(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      attributes: this.getGeometryProps() as Record<string, string>,
      groupId: this.groupId,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      data: { ...this.data },
    };
  }

  protected abstract getGeometrySnapshot(): Record<string, unknown>;
  protected abstract applyGeometrySnapshot(data: Record<string, unknown>): void;
  protected abstract copyGeometryTo(clone: AbstractGraphicElement): void;

  public get x(): number {
    return this.transform.x;
  }
  public get y(): number {
    return this.transform.y;
  }
  public get scaleX(): number {
    return this.transform.scaleX;
  }
  public get scaleY(): number {
    return this.transform.scaleY;
  }
  public get angle(): number {
    return this.transform.angle;
  }

  protected abstract getGeometryProps(): Record<string, unknown>;

  protected parsePoints(points: string): Point[] {
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

  public getRenderSnapshot(): RenderSnapshot {
    return {
      id: this.id,
      type: this.type,
      visible: this.visible,
      matrix: this.transform.toArray(),
      style: this.style.getProps(),
      geometry: this.getGeometryProps(),
    };
  }
}
