import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { EventBus } from '@/core/EventBus';

export interface CommandEvent {
  type: string;
  elementIds: string[];
  diff: Record<string, Record<string, unknown>>;
}

export class CommandTracker {
  private events: EventBus;
  private snapshots = new Map<string, Record<string, unknown>>();

  public constructor(events: EventBus) {
    this.events = events;
  }

  public getSnapshot(el: AbstractGraphicElement): Record<string, unknown> {
    return el.toSnapshot();
  }

  public captureBefore(ids: string[], getElement: (id: string) => AbstractGraphicElement | undefined): void {
    for (const id of ids) {
      const el = getElement(id);
      if (el) {
        this.snapshots.set(id, this.getSnapshot(el));
      }
    }
  }

  public emitDiff(commandType: string, ids: string[], getElement: (id: string) => AbstractGraphicElement | undefined, mode?: string): void {
    const diff: Record<string, Record<string, unknown>> = {};

    for (const id of ids) {
      const before = this.snapshots.get(id);
      const el = getElement(id);
      if (!el) {
        const removed: Record<string, unknown> = {};
        if (before) {
          removed.type = '';
          for (const key of Object.keys(before)) {
            if (key === 'id' || key === 'type') continue;
            (removed as any)[key] = null;
          }
        }
        diff[id] = removed;
        this.snapshots.delete(id);
        continue;
      }

      const after = this.getSnapshot(el);
      const changed: Record<string, unknown> = {};
      for (const key of Object.keys(after)) {
        if (key === 'id') continue;
        const beforeVal = before?.[key];
        const afterVal = after[key];
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
          changed[key] = afterVal;
        }
      }
      changed.type = el.type;

      if (Object.keys(changed).length > 1) {
        diff[id] = changed;
      }

      this.snapshots.delete(id);
    }

    if (Object.keys(diff).length === 0) return;

    const event: CommandEvent = {
      type: `SVG_CAD_${commandType}`,
      elementIds: ids,
      diff,
    };
    if (mode) (event as any).mode = mode;
    this.events.emit(event.type, event);
  }

  public clear(): void {
    this.snapshots.clear();
  }
}
