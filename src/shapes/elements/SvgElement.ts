import { SVG_NS } from '@/constants';
import type { Point, BoundingBox, DirtyTracker, ElementType } from '@/types';
import { RenderQueue } from '@/renderer/RenderQueue';

let globalQueue: RenderQueue | null = null;

export function setRenderQueue(queue: RenderQueue | null): void {
  globalQueue = queue;
}

export abstract class SvgElement implements DirtyTracker {
  public readonly id: string;
  public readonly type: ElementType;
  public readonly element: SVGElement;

  public groupId: string;
  public laserGroupId: string;
  public laserType: string;
  public name: string;
  public visible = true;
  public lock = false;
  public data: Record<string, unknown> = {};

  protected _dirty = false;
  protected _hitArea: Point[] = [];

  public constructor(id: string, type: ElementType, tag: string) {
    this.id = id;
    this.type = type;
    this.groupId = '';
    this.laserGroupId = '';
    this.laserType = '';
    this.name = type;
    this.element = document.createElementNS(SVG_NS, tag);
  }

  public get dirty(): boolean {
    return this._dirty;
  }

  public markClean(): void {
    this._dirty = false;
  }

  public get hitArea(): Point[] {
    if (this._hitArea.length === 0) {
      this.buildHitArea();
    }
    return this._hitArea;
  }

  public invalidateHitArea(): void {
    this._hitArea = [];
    this.setDirty();
  }

  public abstract buildHitArea(): void;

  public getBBox(): BoundingBox {
    const graphicsEl = this.element as SVGGraphicsElement;
    const bbox = graphicsEl.getBBox();
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  }

  public getCenter(): Point {
    const bbox = this.getBBox();
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  public setX(x: number): void {
    const bbox = this.getBBox();
    const dx = x - bbox.x;
    this.translate(dx, 0);
  }

  public setY(y: number): void {
    const bbox = this.getBBox();
    const dy = y - bbox.y;
    this.translate(0, dy);
  }

  public setWidth(w: number): void {
    const bbox = this.getBBox();
    if (bbox.width === 0) return;
    const sx = w / bbox.width;
    const center = this.getCenter();
    this.applyTransform(`scale(${sx}, 1)`, center);
  }

  public setHeight(h: number): void {
    const bbox = this.getBBox();
    if (bbox.height === 0) return;
    const sy = h / bbox.height;
    const center = this.getCenter();
    this.applyTransform(`scale(1, ${sy})`, center);
  }

  public translate(dx: number, dy: number): void {
    this.applyTransform(`translate(${dx}, ${dy})`);
  }

  public scale(sx: number, sy?: number): void {
    const center = this.getCenter();
    const sY = sy ?? sx;
    this.applyTransform(`scale(${sx}, ${sY})`, center);
  }

  public rotate(angle: number, cx?: number, cy?: number): void {
    const center =
      cx !== undefined && cy !== undefined
        ? { x: cx, y: cy }
        : this.getCenter();
    this.applyTransform(`rotate(${angle}, ${center.x}, ${center.y})`);
  }

  public setFill(color: string): void {
    this.element.setAttribute('fill', color);
    this.invalidateHitArea();
  }

  public setStroke(color: string): void {
    this.element.setAttribute('stroke', color);
    this.invalidateHitArea();
  }

  public setStrokeWidth(w: number): void {
    this.element.setAttribute('stroke-width', String(w));
    this.invalidateHitArea();
  }

  public setOpacity(v: number): void {
    this.element.setAttribute('opacity', String(v));
    this.setDirty();
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.element.setAttribute('visibility', v ? 'visible' : 'hidden');
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

  public clone(): SvgElement {
    const cloned = this.createClone();
    cloned.groupId = this.groupId;
    cloned.laserGroupId = this.laserGroupId;
    cloned.laserType = this.laserType;
    cloned.name = this.name;
    cloned.visible = this.visible;
    cloned.lock = this.lock;
    cloned.data = { ...this.data };
    return cloned;
  }

  protected abstract createClone(): SvgElement;

  protected setDirty(): void {
    this._dirty = true;
    globalQueue?.add(this);
  }

  protected getStrokeWidth(): number {
    const sw = this.element.getAttribute('stroke-width');
    return sw ? parseFloat(sw) : 0;
  }

  protected hasFill(): boolean {
    const fill = this.element.getAttribute('fill');
    return fill !== null && fill !== 'none' && fill !== '';
  }

  private applyTransform(transform: string, origin?: Point): void {
    const current = this.element.getAttribute('transform') || '';
    const tx = origin
      ? `${transform} translate(${-origin.x}, ${-origin.y})`
      : transform;
    const originRestore = origin ? `translate(${origin.x}, ${origin.y})` : '';
    this.element.setAttribute(
      'transform',
      `${current} ${originRestore} ${tx}`.trim(),
    );
    this.setDirty();
  }
}
