import type { Point, BoundingBox, ElementType } from '@/types';
import type { FlexTree } from '@/math/flex-tree';
import { Transform } from '../modules/Transform';
import { Style } from '../modules/Style';
import { LaserProps } from '../modules/LaserProps';
import { ReactiveNode } from '@/core/ReactiveNode';

export abstract class AbstractGraphicElement extends ReactiveNode {
  public readonly id: string;
  public readonly type: ElementType;
  public readonly transform = new Transform();
  public readonly style = new Style();
  public readonly laserProps = new LaserProps();

  public groupId = '';
  public name: string;
  public visible = true;
  public lock = false;
  public isPreview = false;
  public isEditingNodes = false;
  public data: Record<string, unknown> = {};
  public flexTree?: FlexTree;

  public onGeometryChanged: ((el: AbstractGraphicElement) => void) | null = null;
  public onColorChanged:
    | ((
        el: AbstractGraphicElement,
        oldFillKey?: string | null,
        oldStrokeKey?: string | null,
      ) => void)
    | null = null;

  _fadedOriginalOpacity: number | null = null;

  constructor(id: string, type: ElementType) {
    super(id, type, 'shapesGroup');
    this.id = id;
    this.type = type;
    this.name = type;
    this.subscribe(['style.fill', 'style.stroke'], () => {
      this.buildHitArea();
      this.onColorChanged?.(this);
    });
    this.subscribe('style.strokeWidth', () => {
      this.buildHitArea();
    });
    this.subscribe('transform.matrix', () => {
      this.onGeometryChanged?.(this);
    });
    this.subscribe(
      ['style.opacity', 'style.visible', 'visible', 'isPreview'],
      () => {},
    );
    this.subscribe(
      ['flexTree.algorithm', 'flexTree.step', 'flexTree.link', 'flexTree.dash', 'flexTree.amplitude'],
      () => {},
    );
  }

  public abstract get hitArea(): Point[];
  public abstract buildHitArea(): void;
  public abstract getBBox(): BoundingBox;
  public abstract toSegmentPolygons(): Point[][];
  public abstract toOutlinePath(): import('./PathElement').PathElement;

  public rebuildHitArea(): void {
    this.buildHitArea();
    this.onGeometryChanged?.(this);
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.style.visible = v;
  }

  public getRenderGeometry(): Record<string, unknown> {
    return this.getGeometryProps();
  }

  public override getRenderingPayload(): Record<string, unknown> {
    const diff = this.renderingDiff;
    const hasFlexTree = this.flexTree !== undefined;

    if (Object.keys(diff).length === 0 && !hasFlexTree) return {};

    const result: Record<string, unknown> = {};

    const m = this.transform.matrix;
    const isIdentity =
      m.a === 1 &&
      m.b === 0 &&
      m.c === 0 &&
      m.d === 1 &&
      m.e === 0 &&
      m.f === 0;
    if (!isIdentity) {
      result.transform = `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
    }

    result.visibility =
      this.style.visible !== false && this.visible !== false
        ? 'visible'
        : 'hidden';

    const fill = this.style.fill;
    result.fill = fill && fill !== '' ? fill : 'none';
    const stroke = this.style.stroke;
    if (stroke && stroke !== '') result.stroke = stroke;
    result['stroke-width'] = String(this.style.strokeWidth);
    result.opacity = String(this.style.opacity);

    const geom = this.getRenderGeometry();
    for (const [key, value] of Object.entries(geom)) {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }

    if (hasFlexTree) {
      result['flexTree.algorithm'] = this.flexTree!.algorithm;
      result['flexTree.step'] = this.flexTree!.step;
      result['flexTree.link'] = this.flexTree!.link;
      result['flexTree.dash'] = this.flexTree!.dash;
      result['flexTree.amplitude'] = this.flexTree!.amplitude;
    }

    return result;
  }

  public transformPoint(p: Point): Point {
    return this.transform.transformPoint(p);
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

  public getWorldBBox(): BoundingBox {
    return this.getTransformedBBox();
  }

  public getWorldCorners(): Point[] {
    const bbox = this.getVisualBBox();
    return [
      this.transformPoint({ x: bbox.x, y: bbox.y }),
      this.transformPoint({ x: bbox.x + bbox.width, y: bbox.y }),
      this.transformPoint({ x: bbox.x + bbox.width, y: bbox.y + bbox.height }),
      this.transformPoint({ x: bbox.x, y: bbox.y + bbox.height }),
    ];
  }

  public getWorldHitPoints(): Point[] {
    const ha = this.hitArea;
    if (ha.length === 0) return [];
    return ha.map((p) => this.transformPoint(p));
  }

  public getCenter(): Point {
    const bbox = this.getTransformedBBox();
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  public getLocalCenter(): Point {
    const bbox = this.getVisualBBox();
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

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

  public setFaded(faded: boolean): void {
    if (faded && this._fadedOriginalOpacity === null) {
      this._fadedOriginalOpacity = this.style.opacity;
      this.style.opacity = 0.2;
    } else if (!faded && this._fadedOriginalOpacity !== null) {
      this.style.opacity = this._fadedOriginalOpacity;
      this._fadedOriginalOpacity = null;
    }
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
    this.setDiff(data as Record<string, any>);
    this.rebuildHitArea();
    this.clearTimeMachineDiff();
  }

  public applySnapshot(snapshot: Record<string, unknown>): void {
    this.setDiff(snapshot as Record<string, any>);
  }

  public getDiffSnapshot(): Record<string, unknown> {
    const d = { ...this.timeMachineDiff.after };
    this.clearTimeMachineDiff();
    return d;
  }

  public getUnsavedDTO(): Record<string, unknown> | null {
    const d = this.saveDiff;
    if (Object.keys(d).length === 0) return null;
    this.clearSaveDiff();
    return d;
  }

  public applyDTO(dto: Record<string, unknown>): void {
    this.setDiff(dto as Record<string, any>);
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

  public clone(): AbstractGraphicElement {
    const Cls = this.constructor as new (id: string) => AbstractGraphicElement;
    const cloned = new Cls(this.id);
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
    this.copyGeometryTo(cloned);
    return cloned;
  }

  protected subscribeGeometry(...keys: string[]): void {
    this.subscribe(keys, () => {
      this.buildHitArea();
      this.onGeometryChanged?.(this);
    });
  }

  protected abstract getGeometrySnapshot(): Record<string, unknown>;
  protected abstract applyGeometrySnapshot(data: Record<string, unknown>): void;
  protected abstract copyGeometryTo(clone: AbstractGraphicElement): void;
  protected abstract getGeometryProps(): Record<string, unknown>;

  protected parsePoints(points: string): Point[] {
    const nums = points
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    const r: Point[] = [];
    for (let i = 0; i < nums.length - 1; i += 2)
      r.push({ x: nums[i], y: nums[i + 1] });
    return r;
  }
}
