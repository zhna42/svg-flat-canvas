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

  public drainForced(): void {
    const items = this.drain();
    for (const el of items) {
      const tx = (el as any)._translate?.x;
      const ty = (el as any)._translate?.y;
      if (tx !== undefined && (tx !== 0 || ty !== 0)) {
        (el as any).element.setAttribute(
          'transform',
          `translate(${tx}, ${ty})`,
        );
      }
      if ('markClean' in el) el.markClean();
    }
  }
}
