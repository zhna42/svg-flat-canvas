import type { Renderer } from '@/renderer/Renderer';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

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

  public remove(id: string): void {
    const index = this.shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.shapes.splice(index, 1);
      this.renderer.removeElement(id);
    }
  }

  public clear(): void {
    this.shapes.length = 0;
    this.renderer.clear();
  }

  public getAll(): AbstractGraphicElement[] {
    return [...this.shapes];
  }
}
