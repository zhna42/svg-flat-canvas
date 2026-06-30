import type { Point, BoundingBox, ElementType } from '@/types';
import { Transform } from '../modules/Transform';
import { Style } from '../modules/Style';
import { LaserProps } from '../modules/LaserProps';
import { AbstractDiff } from './AbstractDiff';
import { getRenderQueue } from '@/utils/render-queue-utils';

export type ElementSnapshot = Record<string, unknown>;

export abstract class AbstractGraphicElement extends AbstractDiff {
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
  public isNodeEditing = false;
  public data: Record<string, unknown> = {};

  public _spatialCellIds: number[] = [];
  public onSpatialIndexChanged: ((el: AbstractGraphicElement) => void) | null =
    null;
  public onColorChanged:
    | ((
        el: AbstractGraphicElement,
        oldFillKey?: string | null,
        oldStrokeKey?: string | null,
      ) => void)
    | null = null;

  constructor(id: string, type: ElementType) {
    super();
    this.id = id;
    this.type = type;
    this.name = type;
    this.subscribe(['style.fill', 'style.stroke'], () => {
      getRenderQueue()?.add(this);
      this.buildHitArea();
      this.onColorChanged?.(this);
    });
    this.subscribe('style.strokeWidth', () => {
      getRenderQueue()?.add(this);
      this.buildHitArea();
    });
    this.subscribe(
      [
        'style.opacity',
        'style.visible',
        'visible',
        'transform.matrix',
        'isPreview',
      ],
      () => getRenderQueue()?.add(this),
    );
  }

  public abstract get hitArea(): Point[];
  public abstract buildHitArea(): void;
  public abstract getBBox(): BoundingBox;
  public abstract toSegmentPolygons(): Point[][];
  public abstract toOutlinePath(): import('./PathElement').PathElement;

  public getSpatialCellIds(): number[] {
    return this._spatialCellIds;
  }
  public setSpatialCellIds(ids: number[]): void {
    this._spatialCellIds = ids;
  }
  public rebuildHitArea(): void {
    this.buildHitArea();
    this.onSpatialIndexChanged?.(this);
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.style.visible = v;
  }

  private _fadedOriginalOpacity: number | null = null;
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
    this.clearHistoryDiff();
  }

  public applySnapshot(snapshot: Record<string, unknown>): void {
    this.setDiff(snapshot as Record<string, any>);
  }

  public getDiffSnapshot(): Record<string, unknown> {
    const d = this.getHistoryDiff();
    this.clearHistoryDiff();
    return d;
  }

  public getUnsavedDTO(): Record<string, unknown> | null {
    const d = this.getBackendDiff();
    if (Object.keys(d).length === 0) return null;
    this.clearBackendDiff();
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
      getRenderQueue()?.add(this);
      this.buildHitArea();
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
