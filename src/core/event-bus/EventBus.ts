import type { BusEvent } from '@/core/type';

export class EventBus {
  private listeners = new Map<string, Set<(event: BusEvent) => void>>();
  private allListeners = new Set<(event: BusEvent) => void>();

  public on(type: string, fn: (event: BusEvent) => void): () => void {
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

  public off(type: string, fn: (event: BusEvent) => void): void {
    if (type === '*') {
      this.allListeners.delete(fn);
      return;
    }
    const set = this.listeners.get(type);
    if (set) set.delete(fn);
  }

  public emit(type: string, data: unknown): void {
    console.log(`[EventBus] ${type}`, data);
    const busEvent: BusEvent = { type, data };
    const set = this.listeners.get(type);
    if (set) {
      for (const fn of set) fn(busEvent);
    }
    for (const fn of this.allListeners) {
      fn(busEvent);
    }
  }

  public removeAll(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }
}
