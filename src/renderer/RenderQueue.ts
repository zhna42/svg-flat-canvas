import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SelectionOverlayElement } from '@/selection/overlay/SelectionOverlayElement';

export enum DirtyFlag {
  Transform = 1 << 0,
  Style = 1 << 1,
  Geometry = 1 << 2,
  Visibility = 1 << 3,
}

export interface DirtyEntry {
  element: AbstractGraphicElement;
  flags: number;
}

export interface Renderable {
  get dirty(): boolean;
  markClean(): void;
  flushToDOM(): void;
}

export class RenderQueue {
  private entries = new Map<string, DirtyEntry>();
  private overlays = new Map<string, SelectionOverlayElement>();
  private drainables = new Map<string, Renderable>();

  public add(
    el: AbstractGraphicElement,
    flags: number = DirtyFlag.Transform |
      DirtyFlag.Style |
      DirtyFlag.Geometry |
      DirtyFlag.Visibility,
  ): void {
    const existing = this.entries.get(el.id);
    if (existing) {
      existing.flags |= flags;
    } else {
      this.entries.set(el.id, { element: el, flags });
    }
  }

  public addOverlay(overlay: SelectionOverlayElement): void {
    this.overlays.set(overlay.id, overlay);
  }

  public addDrainable(id: string, obj: Renderable): void {
    this.drainables.set(id, obj);
  }

  public drain(): DirtyEntry[] {
    const items = Array.from(this.entries.values());
    this.entries.clear();
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
    return this.entries.size;
  }

  public clear(): void {
    this.entries.clear();
    this.overlays.clear();
    this.drainables.clear();
  }
}
