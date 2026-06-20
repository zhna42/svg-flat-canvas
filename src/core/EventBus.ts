export enum Events {
  SelectionChange = 'selectionChange',
  GroupSelect = 'groupSelect',
  GroupsChange = 'groupsChange',
  DragStart = 'dragStart',
  DragMove = 'dragMove',
  DragEnd = 'dragEnd',
  TransformStart = 'transformStart',
  TransformMove = 'transformMove',
  TransformEnd = 'transformEnd',
  ElementCreated = 'elementCreated',
  ElementChanged = 'elementChanged',
  FileCreated = 'fileCreated',
}

export interface FileCreatedEvent {
  groupId: string;
  elements: import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement[];
}

export interface EventMap {
  [Events.SelectionChange]: readonly import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement[];
  [Events.GroupSelect]: string[];
  [Events.GroupsChange]: void;
  [Events.DragStart]: void;
  [Events.DragMove]: void;
  [Events.DragEnd]: void;
  [Events.TransformStart]: import('@/selection/TransformHandler').TransformMode;
  [Events.TransformMove]: void;
  [Events.TransformEnd]: import('@/selection/TransformHandler').TransformMode;
  [Events.ElementCreated]: import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement;
  [Events.ElementChanged]: { elementIds: string[] };
  [Events.FileCreated]: FileCreatedEvent;
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
