import type { HitServiceResult, ServiceHandler } from './types';

export class ServiceHitRegistry {
  private handlers: ServiceHandler[] = [];

  register(handler: ServiceHandler): void {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  remove(name: string): void {
    this.handlers = this.handlers.filter((h) => h.name !== name);
  }

  hitTest(x: number, y: number): HitServiceResult | null {
    for (const handler of this.handlers) {
      const result = handler.hitTest(x, y);
      if (result) return result;
    }
    return null;
  }
}
