export interface BusEvent {
  type: string;
  data: unknown;
}

export class EventBus {
  private listeners = new Map<string, Set<(event: BusEvent) => void>>();
  private allListeners = new Set<(data: any) => void>();

  public on(type: string, fn: (event: any) => void): () => void {
    if (type === '*') {
      this.allListeners.add(fn);
      return () => this.allListeners.delete(fn);
    }
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn);
    return () => this.off(type, fn);
  }

  public off(type: string, fn: (event: any) => void): void {
    if (type === '*') {
      this.allListeners.delete(fn);
      return;
    }
    const set = this.listeners.get(type);
    if (set) set.delete(fn);
  }

  public emit(type: string, data: unknown): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const fn of set) fn({ type, data });
    }
    for (const fn of this.allListeners) {
      fn(data);
    }
  }

  public removeAll(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }
}
