import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { ImageElement } from '@/core/shapes/elements/ImageElement';
import type { CanvasView } from '@/canvas/CanvasView';

export class ShapeManager {
  readonly #view: CanvasView;
  readonly #shapes: AbstractGraphicElement[] = [];
  #registerDirty: ((node: any) => void) | null = null;

  public constructor(view: CanvasView) {
    this.#view = view;
  }

  public setRegisterDirty(fn: (node: any) => void): void {
    this.#registerDirty = fn;
  }

  public add(shape: AbstractGraphicElement): void {
    this.#shapes.push(shape);
    if (this.#registerDirty) {
      shape.pushDiffRendering = this.#registerDirty;
      this.#registerDirty(shape);
    }
  }

  public addElement(el: AbstractGraphicElement): void {
    this.#shapes.push(el);
    if (this.#registerDirty) {
      el.pushDiffRendering = this.#registerDirty;
      this.#registerDirty(el);
    }
  }

  public addPreviewElement(el: AbstractGraphicElement): void {
    el.isPreview = true;
    el.layerName = 'previewGroup';
    this.#shapes.push(el);
    if (this.#registerDirty) {
      el.pushDiffRendering = this.#registerDirty;
      this.#registerDirty(el);
    }
  }

  public remove(id: string): void {
    this._cleanupMaskReferences(id);
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
      this.#view.remove(id);
    }
  }

  public removeElement(id: string): void {
    this._cleanupMaskReferences(id);
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
    }
  }

  public removeElementAndNode(id: string): void {
    this._cleanupMaskReferences(id);
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
      this.#view.remove(id);
    }
  }

  public removePreviewElement(id: string): void {
    this._cleanupMaskReferences(id);
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
      this.#view.remove(id);
    }
  }

  public clear(): void {
    for (const s of this.#shapes) {
      this._cleanupMaskReferences(s.id);
      this.#view.remove(s.id);
    }
    this.#shapes.length = 0;
  }

  public getAll(): AbstractGraphicElement[] {
    return [...this.#shapes];
  }

  public getById(id: string): AbstractGraphicElement | undefined {
    return this.#shapes.find((s) => s.id === id);
  }

  /** Возвращает ID картинок, которые используют указанный элемент как маску. */
  getMaskedImageIds(maskElementId: string): string[] {
    const result: string[] = [];
    for (const shape of this.#shapes) {
      if (
        shape.type === 'image' &&
        (shape as ImageElement).maskElementIds.includes(maskElementId)
      ) {
        result.push(shape.id);
      }
    }
    return result;
  }

  /** Dirty-ит все картинки, которые используют указанный элемент как маску. */
  dirtyMaskedImages(maskElementId: string): void {
    if (!this.#registerDirty) return;
    for (const shape of this.#shapes) {
      if (
        shape.type === 'image' &&
        (shape as ImageElement).maskElementIds.includes(maskElementId)
      ) {
        this.#registerDirty(shape);
      }
    }
  }

  /** Удаляет ссылки на удаляемый элемент из maskElementIds всех картинок. */
  private _cleanupMaskReferences(elementId: string): void {
    for (const shape of this.#shapes) {
      if (shape.type === 'image') {
        const img = shape as ImageElement;
        if (img.maskElementIds.includes(elementId)) {
          img.removeMaskElementId(elementId);
          this.updateMaskBBox(shape.id);
        }
      }
    }
  }

  moveMaskElements(imageId: string, oldMatrix: DOMMatrix, newMatrix: DOMMatrix): void {
    const image = this.getById(imageId) as ImageElement | undefined;
    if (!image || image.type !== 'image') return;

    let delta: DOMMatrix;
    try {
      delta = newMatrix.multiply(oldMatrix.inverse());
    } catch {
      delta = new DOMMatrix();
      delta.e = newMatrix.e - oldMatrix.e;
      delta.f = newMatrix.f - oldMatrix.f;
    }

    for (const maskId of image.maskElementIds) {
      const mask = this.getById(maskId);
      if (!mask) continue;
      const newMaskMatrix = delta.multiply(mask.transform.matrix);
      mask.transform.matrix = newMaskMatrix;
      if (this.#registerDirty) this.#registerDirty(mask);
    }

    this.updateMaskBBox(imageId);
  }

  /** Пересчитывает maskBBox для изображения на основе позиций его масок. */
  updateMaskBBox(imageId: string): void {
    const image = this.getById(imageId) as ImageElement | undefined;
    if (!image || image.type !== 'image') return;

    if (image.maskElementIds.length === 0) {
      image.maskBBox = null;
      image.rebuildHitArea();
      return;
    }

    const imgBBox = image.getFullBBox();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let anyFound = false;

    for (const maskId of image.maskElementIds) {
      const mask = this.getById(maskId);
      if (!mask) continue;
      const mb = mask.getTransformedBBox();
      if (mb.width <= 0 || mb.height <= 0) continue;
      anyFound = true;
      if (mb.x < minX) minX = mb.x;
      if (mb.y < minY) minY = mb.y;
      if (mb.x + mb.width > maxX) maxX = mb.x + mb.width;
      if (mb.y + mb.height > maxY) maxY = mb.y + mb.height;
    }

    if (!anyFound) {
      image.maskBBox = null;
    } else {
      image.maskBBox = {
        x: Math.max(minX, imgBBox.x),
        y: Math.max(minY, imgBBox.y),
        width: Math.max(1, Math.min(maxX, imgBBox.x + imgBBox.width) - Math.max(minX, imgBBox.x)),
        height: Math.max(1, Math.min(maxY, imgBBox.y + imgBBox.height) - Math.max(minY, imgBBox.y)),
      };
    }
    image.rebuildHitArea();
  }

  getIndex(id: string): number {
    return this.#shapes.findIndex((s) => s.id === id);
  }

  raise(id: string): void {
    const i = this.getIndex(id);
    if (i < 0 || i >= this.#shapes.length - 1) return;
    [this.#shapes[i], this.#shapes[i + 1]] = [this.#shapes[i + 1], this.#shapes[i]];
  }

  lower(id: string): void {
    const i = this.getIndex(id);
    if (i <= 0) return;
    [this.#shapes[i], this.#shapes[i - 1]] = [this.#shapes[i - 1], this.#shapes[i]];
  }

  raiseToTop(id: string): void {
    const i = this.getIndex(id);
    if (i < 0) return;
    const el = this.#shapes.splice(i, 1)[0];
    this.#shapes.push(el);
  }

  lowerToBottom(id: string): void {
    const i = this.getIndex(id);
    if (i < 0) return;
    const el = this.#shapes.splice(i, 1)[0];
    this.#shapes.unshift(el);
  }

  insertBefore(id: string, referenceId: string): void {
    const i = this.getIndex(id);
    const ri = this.getIndex(referenceId);
    if (i < 0 || ri < 0) return;
    const el = this.#shapes.splice(i, 1)[0];
    const newRi = id === referenceId ? ri : this.#shapes.findIndex((s) => s.id === referenceId);
    this.#shapes.splice(newRi, 0, el);
  }
}
