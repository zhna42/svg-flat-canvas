import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export class RenderQueue {
  private set = new Set<AbstractGraphicElement>();

  public add(el: AbstractGraphicElement): void {
    this.set.add(el);
  }

  public drain(): AbstractGraphicElement[] {
    const items = Array.from(this.set);
    this.set.clear();
    return items;
  }

  public get size(): number {
    return this.set.size;
  }

  public clear(): void {
    this.set.clear();
  }
}
