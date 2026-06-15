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

  public groupId = '';
  public laserGroupId = '';
  public laserType = '';
  public name: string;
  public visible = true;
  public lock = false;
  public data: Record<string, unknown> = {};

  protected _dirty = false;
  protected _hitArea: Point[] = [];

  public matrix = new DOMMatrix();

  public x = 0;
  public y = 0;
  public scaleX = 1;
  public scaleY = 1;
  public angle = 0;

  public onDirty: (() => void) | null = null;

  public constructor(id: string, type: ElementType, tag: string) {
    this.id = id;
    this.type = type;
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
    if (this._hitArea.length === 0) this.buildHitArea();
    return this._hitArea;
  }

  public invalidateHitArea(): void {
    this._hitArea = [];
    this.setDirty();
  }

  public applyTransformation(
    type: string,
    delta: Record<string, number>,
    baseMatrix?: DOMMatrix,
  ): void {
    if (this.lock) return;

    // Используем сохраненную стартовую матрицу или текущую (если baseMatrix не передан)
    const startingMatrix = baseMatrix ? new DOMMatrix(baseMatrix) : this.matrix;

    switch (type) {
      case 'translate': {
        // При драге: delta.x и delta.y — это ПОЛНЫЙ сдвиг мыши с момента tryStart
        const m = new DOMMatrix().translateSelf(delta.x ?? 0, delta.y ?? 0);
        this.matrix = m.multiply(startingMatrix);
        break;
      }

      case 'rotate': {
        // При ротейте: delta.angle — это ПОЛНЫЙ угол поворота с момента tryStart
        const angleDelta = delta.angle ?? 0;

        const localCenter = this.getLocalCenter();
        const globalCenter = startingMatrix.transformPoint({
          x: localCenter.x,
          y: localCenter.y,
        });

        this.matrix = new DOMMatrix()
          .translateSelf(globalCenter.x, globalCenter.y)
          .rotateSelf(0, 0, angleDelta)
          .translateSelf(-globalCenter.x, -globalCenter.y)
          .multiply(startingMatrix);
        break;
      }

      case 'resize': {
        // Абсолютный коэффициент изменения масштаба с момента tryStart (например, 1.25)
        const sx = delta.sx ?? 1;
        const sy = delta.sy ?? 1;

        // 1. Декомпозируем СТАРТОВУЮ матрицу полностью
        const baseAngleRad = Math.atan2(startingMatrix.b, startingMatrix.a);
        const baseScaleX =
          Math.sqrt(
            startingMatrix.a * startingMatrix.a +
              startingMatrix.b * startingMatrix.b,
          ) * (startingMatrix.a < 0 ? -1 : 1);
        const baseScaleY =
          Math.sqrt(
            startingMatrix.c * startingMatrix.c +
              startingMatrix.d * startingMatrix.d,
          ) * (startingMatrix.d < 0 ? -1 : 1);

        // 2. Находим глобальную точку опоры (origin)
        const globalOrigin = { x: delta.originX ?? 0, y: delta.originY ?? 0 };

        // 3. Переводим точку опоры в ЛОКАЛЬНЫЕ координаты элемента (до всех скейлов и поворотов!)
        // Для этого инвертируем стартовую матрицу
        const localOrigin = new DOMMatrix(startingMatrix)
          .invertSelf()
          .transformPoint(globalOrigin);

        // 4. Строим матрицу С НУЛЯ в строгом порядке, сохраняя прошлую историю:
        this.matrix = new DOMMatrix()
          // А) Задаем глобальное положение (из стартовой матрицы)
          .translateSelf(startingMatrix.e, startingMatrix.f)
          // Б) Восстанавливаем стартовый поворот
          .rotateRadiansSelf(baseAngleRad)
          // В) Переносим систему координат в локальную точку опоры
          .translateSelf(localOrigin.x, localOrigin.y)
          // Г) Применяем НОВЫЙ масштаб, перемножая его со СТАРТОВЫМ масштабом элемента
          .scaleSelf(sx * baseScaleX, sy * baseScaleY)
          // Д) Возвращаем систему координат обратно
          .translateSelf(-localOrigin.x, -localOrigin.y);
        break;
      }

      default:
        return;
    }

    this.decomposeMatrix();
    this.invalidateHitArea();
  }

  public decomposeMatrix(): void {
    this.x = this.matrix.e;
    this.y = this.matrix.f;
    this.scaleX =
      Math.sqrt(this.matrix.a * this.matrix.a + this.matrix.b * this.matrix.b) *
      (this.matrix.a < 0 ? -1 : 1);
    this.scaleY =
      Math.sqrt(this.matrix.c * this.matrix.c + this.matrix.d * this.matrix.d) *
      (this.matrix.d < 0 ? -1 : 1);
    this.angle = Math.atan2(this.matrix.b, this.matrix.a) * (180 / Math.PI);
  }

  public transformPoint(p: Point): Point {
    return this.matrix.transformPoint({ x: p.x, y: p.y });
  }

  public abstract buildHitArea(): void;

  public getBBox(): BoundingBox {
    try {
      const graphicsEl = this.element as SVGGraphicsElement;
      const bbox = graphicsEl.getBBox();
      return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
    } catch {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  public getLocalCenter(): Point {
    const bbox = this.getBBox();
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

  public setX(x: number): void {
    this.applyTransformation('translate', { x: x - this.x, y: 0 });
  }
  public setY(y: number): void {
    this.applyTransformation('translate', { x: 0, y: y - this.y });
  }

  public setWidth(w: number): void {
    const bbox = this.getTransformedBBox();
    if (bbox.width === 0) return;
    this.applyTransformation('resize', {
      sx: w / bbox.width,
      sy: 1,
      originX: bbox.x,
      originY: bbox.y,
    });
  }

  public setHeight(h: number): void {
    const bbox = this.getTransformedBBox();
    if (bbox.height === 0) return;
    this.applyTransformation('resize', {
      sx: 1,
      sy: h / bbox.height,
      originX: bbox.x,
      originY: bbox.y,
    });
  }

  public translate(dx: number, dy: number): void {
    this.applyTransformation('translate', { x: dx, y: dy });
  }
  public rotate(angle: number): void {
    this.applyTransformation('rotate', { angle });
  }

  public scale(sx: number, sy?: number): void {
    const bbox = this.getTransformedBBox();
    const sY = sy ?? sx;
    this.applyTransformation('resize', {
      sx,
      sy: sY,
      originX: bbox.x + bbox.width / 2,
      originY: bbox.y + bbox.height / 2,
    });
  }

  public flushTransformToCoords(): void {
    this.matrix = new DOMMatrix();
    this.decomposeMatrix();
    this.element.removeAttribute('transform');
    this.invalidateHitArea();
    this.setDirty();
  }

  public flattenTransformToAttrs(): void {
    this.flushTransformToCoords();
  }

  public applyDelta(dx: number, dy: number): void {
    this.applyTransformation('translate', { x: dx, y: dy });
  }

  protected getAttrAsNum(name: string, fallback: number): number {
    const v = this.element.getAttribute(name);
    return v !== null ? parseFloat(v) : fallback;
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
      for (const [key, value] of Object.entries(attrs))
        this.element.setAttribute(key, value);
    }
    if (typeof dto.groupId === 'string') this.groupId = dto.groupId;
    if (typeof dto.name === 'string') this.name = dto.name;
    if (typeof dto.visible === 'boolean') this.visible = dto.visible;
    if (typeof dto.lock === 'boolean') this.lock = dto.lock;
    if (dto.data && typeof dto.data === 'object')
      this.data = { ...(dto.data as Record<string, unknown>) };
    if (
      typeof dto.textContent === 'string' &&
      this.element.textContent !== null
    )
      this.element.textContent = dto.textContent;
    this.matrix = new DOMMatrix();
    this.decomposeMatrix();
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
    if (this.element.textContent) result.textContent = this.element.textContent;
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
}
