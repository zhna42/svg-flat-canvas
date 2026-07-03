import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
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
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
      this.#view.remove(id);
    }
  }

  public removeElement(id: string): void {
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
    }
  }

  public removeElementAndNode(id: string): void {
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
      this.#view.remove(id);
    }
  }

  public removePreviewElement(id: string): void {
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
      this.#view.remove(id);
    }
  }

  public clear(): void {
    for (const s of this.#shapes) {
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
}
