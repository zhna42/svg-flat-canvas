import { SVG_NS } from '@/constants';
import { getGroupRectQueue } from '@/utils/group-rect-queue';

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
    getGroupRectQueue()?.add(this as any);
  }

  public setDirty(): void {
    getGroupRectQueue()?.add(this as any);
  }

  public toDOM(): SVGRectElement {
    return this.element;
  }

  public destroy(): void {
    this.element.remove();
  }
}
