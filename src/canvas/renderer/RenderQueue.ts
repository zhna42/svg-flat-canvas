import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Renderable } from '@/types';

export class RenderQueue {
  private elements = new Map<string, AbstractGraphicElement>();
  private drainables = new Map<string, Renderable>();

  public add(el: AbstractGraphicElement): void {
    this.elements.set(el.id, el);
  }

  public addDrainable(id: string, obj: Renderable): void {
    this.drainables.set(id, obj);
  }

  public drain(): AbstractGraphicElement[] {
    const items = Array.from(this.elements.values());
    this.elements.clear();
    return items;
  }

  public drainDrainables(): Renderable[] {
    const items: Renderable[] = [];
    for (const obj of this.drainables.values()) {
      if (obj.dirty) {
        items.push(obj);
      }
    }
    return items;
  }

  public get size(): number {
    return this.elements.size;
  }

  public clear(): void {
    this.elements.clear();
    this.drainables.clear();
  }
}
