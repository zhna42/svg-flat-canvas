import type { Renderer } from '@/renderer/Renderer';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { getRenderQueue } from '@/utils/render-queue-utils';

export class ShapeManager {
  private readonly renderer: Renderer;
  private readonly shapes: AbstractGraphicElement[] = [];

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  public add(shape: AbstractGraphicElement): void {
    this.shapes.push(shape);
    this.renderer.addElement(shape.id, shape.type);
  }

  public addElement(el: AbstractGraphicElement): void {
    this.shapes.push(el);
    this.renderer.addElement(el.id, el.type);
    getRenderQueue()?.add(el);
  }

  public addPreviewElement(el: AbstractGraphicElement): void {
    this.shapes.push(el);
    this.renderer.addPreviewElement(el.id, el.type);
    getRenderQueue()?.add(el);
  }

  public remove(id: string): void {
    const index = this.shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.shapes.splice(index, 1);
      this.renderer.removeElement(id);
    }
  }

  public removeElement(id: string): void {
    const index = this.shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.shapes.splice(index, 1);
    }
  }

  public removeElementAndNode(id: string): void {
    const index = this.shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.shapes.splice(index, 1);
      this.renderer.removeElement(id);
    }
  }

  public removePreviewElement(id: string): void {
    const index = this.shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.shapes.splice(index, 1);
      this.renderer.removePreviewElement(id);
    }
  }

  public clear(): void {
    this.shapes.length = 0;
    this.renderer.clear();
  }

  public getAll(): AbstractGraphicElement[] {
    return [...this.shapes];
  }

  public getById(id: string): AbstractGraphicElement | undefined {
    return this.shapes.find((s) => s.id === id);
  }
}
