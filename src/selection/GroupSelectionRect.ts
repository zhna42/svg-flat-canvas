import { SVG_NS } from '@/constants';
import { RenderQueue } from '@/renderer/RenderQueue';

let globalQueue: RenderQueue | null = null;

export function setGroupRectQueue(queue: RenderQueue | null): void {
  globalQueue = queue;
}

export class GroupSelectionRect {
  public readonly element: SVGRectElement;
  public readonly _translate = { x: 0, y: 0 };

  public constructor() {
    this.element = document.createElementNS(SVG_NS, 'rect');
    this.element.setAttribute('fill', 'none');
    this.element.setAttribute('stroke', '#4285f4');
    this.element.setAttribute('pointer-events', 'none');
  }

  public applyDelta(dx: number, dy: number): void {
    this._translate.x += dx;
    this._translate.y += dy;
    if (globalQueue) globalQueue.add(this as any);
  }

  public setDirty(): void {
    if (globalQueue) globalQueue.add(this as any);
  }

  public toDOM(): SVGRectElement {
    return this.element;
  }

  public destroy(): void {
    this.element.remove();
  }
}
