import type { SvgElement } from '@/shapes/elements/SvgElement';

export class RenderQueue {
  private set = new Set<SvgElement>();

  public add(el: SvgElement): void {
    this.set.add(el);
  }

  public drain(): SvgElement[] {
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
