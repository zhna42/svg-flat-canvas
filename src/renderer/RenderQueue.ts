import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SelectionOverlayElement } from '@/selection/overlay/SelectionOverlayElement';

export interface Renderable {
  get dirty(): boolean;
  markClean(): void;
  flushToDOM(): void;
}

export class RenderQueue {
  private elements = new Map<string, AbstractGraphicElement>();
  private overlays = new Map<string, SelectionOverlayElement>();
  private drainables = new Map<string, Renderable>();

  public add(el: AbstractGraphicElement): void {
    this.elements.set(el.id, el);
  }

  public addOverlay(overlay: SelectionOverlayElement): void {
    this.overlays.set(overlay.id, overlay);
  }

  public addDrainable(id: string, obj: Renderable): void {
    this.drainables.set(id, obj);
  }

  public drain(): AbstractGraphicElement[] {
    const items = Array.from(this.elements.values());
    this.elements.clear();
    return items;
  }

  public drainOverlays(): SelectionOverlayElement[] {
    const items = Array.from(this.overlays.values());
    this.overlays.clear();
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
    this.overlays.clear();
    this.drainables.clear();
  }
}
