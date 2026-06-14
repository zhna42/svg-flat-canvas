export enum Events {
  SelectionChange = 'selectionChange',
  GroupSelect = 'groupSelect',
  GroupsChange = 'groupsChange',
  DragStart = 'dragStart',
  DragMove = 'dragMove',
  DragEnd = 'dragEnd',
}

export interface EventMap {
  [Events.SelectionChange]: readonly import('@/shapes/elements/SvgElement').SvgElement[];
  [Events.GroupSelect]: string[];
  [Events.GroupsChange]: void;
  [Events.DragStart]: void;
  [Events.DragMove]: void;
  [Events.DragEnd]: void;
}

type Listener<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Function>>();

  public on<E extends Events>(event: E, fn: Listener<EventMap[E]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => this.off(event, fn);
  }

  public off<E extends Events>(event: E, fn: Listener<EventMap[E]>): void {
    const set = this.listeners.get(event);
    if (set) set.delete(fn);
  }

  public emit<E extends Events>(event: E, data: EventMap[E]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      fn(data);
    }
  }

  public removeAll(): void {
    this.listeners.clear();
  }
}
