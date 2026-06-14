import type { Renderer } from '@/renderer/Renderer';
import type { SvgElement } from '@/shapes/elements/SvgElement';

export class ShapeManager {
  private readonly renderer: Renderer;
  private readonly shapes: SvgElement[] = [];

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  public add(shape: SvgElement): void {
    this.shapes.push(shape);
    this.renderer.addElementShaped(shape.element);
  }

  public remove(id: string): void {
    const index = this.shapes.findIndex((s) => s.id === id);
    if (index !== -1) {
      const [shape] = this.shapes.splice(index, 1);
      this.renderer.removeElement(shape.element);
    }
  }

  public clear(): void {
    for (const shape of this.shapes) {
      this.renderer.removeElement(shape.element);
    }
    this.shapes.length = 0;
  }

  public getAll(): SvgElement[] {
    return [...this.shapes];
  }
}
