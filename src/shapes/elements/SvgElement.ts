import { SVG_NS } from '@/constants';
import type { Point, BoundingBox, DirtyTracker, ElementType, TransformOp } from '@/types';
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
  public readonly _translate = { x: 0, y: 0 };
  public _scaleX = 1;
  public _scaleY = 1;
  public _rotate = 0;
  public _rotateCx = 0;
  public _rotateCy = 0;
  public onDirty: (() => void) | null = null;

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

  public applyDelta(dx: number, dy: number): void {
    this._translate.x += dx;
    this._translate.y += dy;
    this.setDirty();
  }

  public applyTransformOp(op: TransformOp): void {
    switch (op.type) {
      case 'translate':
        this.applyDelta(op.dx, op.dy);
        break;
      case 'resize': {
        const { handle, dx, dy, ox, oy, ow, oh, otx, oty, osx, osy } = op;
        let w = ow, h = oh;
        const flipW = handle === 'w' || handle === 'nw' || handle === 'sw';
        const flipH = handle === 'n' || handle === 'nw' || handle === 'ne';
        if (flipW) { w = ow - dx / osx; }
        else if (handle === 'e' || handle === 'ne' || handle === 'se') { w = ow + dx / osx; }
        if (flipH) { h = oh - dy / osy; }
        else if (handle === 's' || handle === 'se' || handle === 'sw') { h = oh + dy / osy; }
        w = Math.max(10 / osx, w);
        h = Math.max(10 / osy, h);
        const sx = (w / ow) * osx;
        const sy = (h / oh) * osy;
        let pinX = ox, pinY = oy;
        if (flipW) pinX = ox + ow;
        if (flipH) pinY = oy + oh;
        this._scaleX = sx;
        this._scaleY = sy;
        this._translate.x = otx + pinX - pinX * sx / osx;
        this._translate.y = oty + pinY - pinY * sy / osy;
        this.setDirty();
        break;
      }
      case 'rotate': {
        this._rotate = op.angle;
        this._rotateCx = op.cx;
        this._rotateCy = op.cy;
        this.setDirty();
        break;
      }
    }
  }

  public flushTransformToCoords(): void {
    this.flattenTranslateDelta(this._translate.x, this._translate.y);
    if (this._scaleX === 1 && this._scaleY === 1 && this._rotate === 0) {
      this.element.removeAttribute('transform');
    }
    this._translate.x = 0;
    this._translate.y = 0;
    this.invalidateHitArea();
    this.setDirty();
  }

  public abstract buildHitArea(): void;

  public getBBox(): BoundingBox {
    const graphicsEl = this.element as SVGGraphicsElement;
    const bbox = graphicsEl.getBBox();
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  }

  public toDOMMatrix(): DOMMatrix {
    const t = this.element.getAttribute('transform');
    if (!t) return new DOMMatrix();
    try {
      return new DOMMatrix(t);
    } catch {
      return new DOMMatrix();
    }
  }

  public getTransformedBBox(): BoundingBox {
    const pts = this.hitArea;
    if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    const cos = Math.cos((this._rotate * Math.PI) / 180);
    const sin = Math.sin((this._rotate * Math.PI) / 180);

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      const dx = p.x - this._rotateCx;
      const dy = p.y - this._rotateCy;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      const sx = rx * this._scaleX;
      const sy = ry * this._scaleY;
      const px = sx + this._rotateCx + this._translate.x;
      const py = sy + this._rotateCy + this._translate.y;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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

  protected flattenTranslateDelta(_dx: number, _dy: number): void {}

  public flattenTransformToAttrs(): void {
    this._scaleX = 1;
    this._scaleY = 1;
    this._rotate = 0;
    this._translate.x = 0;
    this._translate.y = 0;
    this.element.removeAttribute('transform');
    this.invalidateHitArea();
    this.setDirty();
  }

  protected getAttrAsNum(name: string, fallback: number): number {
    const v = this.element.getAttribute(name);
    return v !== null ? parseFloat(v) : fallback;
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

  public applyDTO(dto: Record<string, unknown>): void {
    const attrs = dto.attributes as Record<string, string> | undefined;
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        this.element.setAttribute(key, value);
      }
    }
    if (typeof dto.groupId === 'string') this.groupId = dto.groupId;
    if (typeof dto.name === 'string') this.name = dto.name;
    if (typeof dto.visible === 'boolean') this.visible = dto.visible;
    if (typeof dto.lock === 'boolean') this.lock = dto.lock;
    if (dto.data && typeof dto.data === 'object') this.data = { ...(dto.data as Record<string, unknown>) };
    if (typeof dto.textContent === 'string' && this.element.textContent !== null) {
      this.element.textContent = dto.textContent;
    }
    this._translate.x = 0;
    this._translate.y = 0;
    this._hitArea = [];
    this._dirty = true;
    this.onDTOApplied();
  }

  public toDTO(): Record<string, unknown> {
    const attrs: Record<string, string> = {};
    for (let i = 0; i < this.element.attributes.length; i++) {
      const attr = this.element.attributes[i];
      attrs[attr.name] = attr.value;
    }

    const result: Record<string, unknown> = {
      id: this.id,
      type: this.type,
      attributes: attrs,
      groupId: this.groupId,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      data: { ...this.data },
    };

    if (this.element.textContent) {
      result.textContent = this.element.textContent;
    }

    return result;
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

  protected onDTOApplied(): void {}

  public setDirty(): void {
    this._dirty = true;
    globalQueue?.add(this);
    this.onDirty?.();
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
