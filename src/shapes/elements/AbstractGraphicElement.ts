import type { Point, BoundingBox, ElementType } from '@/types';
import { Transform } from '../modules/Transform';
import { Style } from '../modules/Style';
import { getRenderQueue } from '@/utils/render-queue-utils';
import { DirtyFlag } from '@/renderer/RenderQueue';

export interface RenderSnapshot {
  id: string;
  type: ElementType;
  visible: boolean;
  matrix: number[];
  style: Record<string, unknown>;
  geometry: Record<string, unknown>;
}

export type ElementSnapshot = Record<string, unknown>;

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
  protected diffKeysForRedering = new Set<string>();
  protected diffKeysForTimeMashin = new Set<string>();

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

  public markRenderKey(key: string): void {
    this.diffKeysForRedering.add(key);
    this.diffKeysForTimeMashin.add(key);
  }

  public markRenderKeys(...keys: string[]): void {
    for (const key of keys) {
      this.diffKeysForRedering.add(key);
      this.diffKeysForTimeMashin.add(key);
    }
  }

  public getDiffKeysForRedering(): Set<string> {
    return this.diffKeysForRedering;
  }

  public getDiffKeysForTimeMashin(): Set<string> {
    return this.diffKeysForTimeMashin;
  }

  public flushRenderDiff(): ElementSnapshot {
    const keys = Array.from(this.diffKeysForRedering);
    this.diffKeysForRedering.clear();
    if (keys.length === 0) return {};
    return this.buildSnapshotFromKeys(keys);
  }

  public получитьCнимокDiff(): ElementSnapshot {
    const keys = Array.from(this.diffKeysForTimeMashin);
    this.diffKeysForTimeMashin.clear();
    if (keys.length === 0) return {};
    return this.buildSnapshotFromKeys(keys);
  }

  public получитьCнимокFull(): ElementSnapshot {
    return this.toSnapshot();
  }

  public applyCнимок(snapshot: ElementSnapshot): void {
    this.applyCommonSnapshot(snapshot);
    this.applyGeometrySnapshot(snapshot);
    if (this.diffKeysForRedering.size > 0) {
      this.requestRender();
    }
  }

  private buildSnapshotFromKeys(keys: string[]): ElementSnapshot {
    const snapshot: ElementSnapshot = {};
    for (const key of keys) {
      switch (key) {
        case 'id':
          snapshot.id = this.id;
          break;
        case 'type':
          snapshot.type = this.type;
          break;
        case 'groupId':
          snapshot.groupId = this.groupId;
          break;
        case 'laserGroupId':
          snapshot.laserGroupId = this.laserGroupId;
          break;
        case 'laserType':
          snapshot.laserType = this.laserType;
          break;
        case 'name':
          snapshot.name = this.name;
          break;
        case 'visible':
          snapshot.visible = this.visible;
          break;
        case 'lock':
          snapshot.lock = this.lock;
          break;
        case 'isPreview':
          snapshot.isPreview = this.isPreview;
          break;
        case 'isNodeEditing':
          snapshot.isNodeEditing = this.isNodeEditing;
          break;
        case 'data':
          snapshot.data = { ...this.data };
          break;
        case 'fill':
          snapshot.fill = this.style.fill;
          break;
        case 'stroke':
          snapshot.stroke = this.style.stroke;
          break;
        case 'strokeWidth':
          snapshot.strokeWidth = this.style.strokeWidth;
          break;
        case 'opacity':
          snapshot.opacity = this.style.opacity;
          break;
        case 'matrix':
          snapshot.matrix = this.transform.matrix.toString();
          break;
        default:
          this.buildAdditionalSnapshotKey(key, snapshot);
      }
    }
    return snapshot;
  }

  protected buildAdditionalSnapshotKey(
    _key: string,
    _snapshot: ElementSnapshot,
  ): void {}

  public requestRender(): void {
    this._dirty = true;
    const flags = this.computeDirtyFlags();
    getRenderQueue()?.add(this, flags);
    this.onDirty?.();
  }

  private computeDirtyFlags(): number {
    let flags = 0;
    for (const key of this.diffKeysForRedering) {
      switch (key) {
        case 'matrix':
          flags |= DirtyFlag.Transform;
          break;
        case 'fill':
        case 'stroke':
        case 'strokeWidth':
        case 'opacity':
        case 'style.visible':
          flags |= DirtyFlag.Style;
          break;
        case 'visible':
          flags |= DirtyFlag.Visibility;
          break;
        default:
          flags |= DirtyFlag.Geometry;
          break;
      }
    }
    if (flags === 0) {
      flags =
        DirtyFlag.Transform |
        DirtyFlag.Style |
        DirtyFlag.Geometry |
        DirtyFlag.Visibility;
    }
    return flags;
  }

  public setDirty(): void {
    this._dirty = true;
    getRenderQueue()?.add(this);
    this.onDirty?.();
  }

  public setDirtyTransform(): void {
    this._dirty = true;
    getRenderQueue()?.add(this, DirtyFlag.Transform);
    this.onDirty?.();
  }

  public setDirtyStyle(): void {
    this._dirty = true;
    getRenderQueue()?.add(this, DirtyFlag.Style);
    this.onDirty?.();
  }

  public setDirtyGeometry(): void {
    this._dirty = true;
    getRenderQueue()?.add(this, DirtyFlag.Geometry);
    this.onDirty?.();
  }

  public setDirtyAll(): void {
    this._dirty = true;
    getRenderQueue()?.add(this);
    this.onDirty?.();
  }

  public abstract get hitArea(): Point[];

  public abstract buildHitArea(): void;

  public invalidateHitArea(): void {
    this.buildHitArea();
    this.markRenderKey('matrix');
    this.requestRender();
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

    this.markRenderKey('matrix');
    this.requestRender();
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
    this.markRenderKey('fill');
    this.buildHitArea();
    this.requestRender();
  }

  public setStroke(color: string): void {
    this.style.stroke = color;
    this.markRenderKey('stroke');
    this.buildHitArea();
    this.requestRender();
  }

  public setStrokeWidth(w: number): void {
    this.style.strokeWidth = w;
    this.markRenderKey('strokeWidth');
    this.buildHitArea();
    this.requestRender();
  }

  public setOpacity(v: number): void {
    this.style.opacity = v;
    this.markRenderKey('opacity');
    this.requestRender();
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.style.visible = v;
    this.markRenderKeys('visible', 'style.visible');
    this.requestRender();
  }

  public setLock(v: boolean): void {
    this.lock = v;
    this.markRenderKey('lock');
  }

  public setName(v: string): void {
    this.name = v;
    this.markRenderKey('name');
  }

  public setGroupId(v: string): void {
    this.groupId = v;
    this.markRenderKey('groupId');
  }

  public setLaserGroupId(v: string): void {
    this.laserGroupId = v;
    this.markRenderKey('laserGroupId');
  }

  public setLaserType(v: string): void {
    this.laserType = v;
    this.markRenderKey('laserType');
  }

  public setIsPreview(v: boolean): void {
    this.isPreview = v;
    this.markRenderKey('isPreview');
  }

  public setIsNodeEditing(v: boolean): void {
    this.isNodeEditing = v;
    this.markRenderKey('isNodeEditing');
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
    this.buildHitArea();
    if (this.diffKeysForRedering.size > 0) {
      this.requestRender();
    }
  }

  protected applyCommonSnapshot(data: Record<string, unknown>): void {
    if (typeof data.groupId === 'string') this.setGroupId(data.groupId);
    if (typeof data.name === 'string') this.setName(data.name);
    if (typeof data.visible === 'boolean') {
      this.setVisible(data.visible);
    }
    if (typeof data.lock === 'boolean') this.setLock(data.lock);
    if (data.data && typeof data.data === 'object') {
      this.data = { ...(data.data as Record<string, unknown>) };
      this.markRenderKey('data');
    }
    if (typeof data.fill === 'string') this.setFill(data.fill);
    if (typeof data.stroke === 'string') this.setStroke(data.stroke);
    if (typeof data.strokeWidth === 'number')
      this.setStrokeWidth(data.strokeWidth);
    if (typeof data.opacity === 'number') this.setOpacity(data.opacity);
    if (typeof data.matrix === 'string') {
      this.transform.matrix = new DOMMatrix(data.matrix);
      this.markRenderKey('matrix');
    } else {
      this.transform.reset();
      this.markRenderKey('matrix');
    }
  }

  public clone(): AbstractGraphicElement {
    const Cls = this.constructor as new (id: string) => AbstractGraphicElement;
    const cloned = new Cls(this.id);
    cloned.setGroupId(this.groupId);
    cloned.setLaserGroupId(this.laserGroupId);
    cloned.setLaserType(this.laserType);
    cloned.setName(this.name);
    cloned.setVisible(this.visible);
    cloned.setLock(this.lock);
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
    if (this.diffKeysForRedering.size > 0) {
      this.requestRender();
    }
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
    const diff = this.flushRenderDiff();
    if (Object.keys(diff).length > 0) {
      return {
        id: this.id,
        type: this.type,
        visible:
          diff.visible !== undefined ? (diff.visible as boolean) : this.visible,
        matrix:
          diff.matrix !== undefined
            ? this.transform.toArray()
            : this.transform.toArray(),
        style: {
          fill:
            diff.fill !== undefined ? (diff.fill as string) : this.style.fill,
          stroke:
            diff.stroke !== undefined
              ? (diff.stroke as string)
              : this.style.stroke,
          strokeWidth:
            diff.strokeWidth !== undefined
              ? (diff.strokeWidth as number)
              : this.style.strokeWidth,
          opacity:
            diff.opacity !== undefined
              ? (diff.opacity as number)
              : this.style.opacity,
          visible:
            diff['style.visible'] !== undefined
              ? (diff['style.visible'] as boolean)
              : this.style.visible,
        },
        geometry: this.getGeometryProps(),
      };
    }
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
