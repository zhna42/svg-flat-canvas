import { BaseSelectionBox } from './BaseSelectionBox';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { IRenderableNode } from '@/types';

export class SelectionElementBox extends BaseSelectionBox {
  constructor(elementId: string, registerDirty: (node: IRenderableNode) => void) {
    super(`sel-${elementId}`, elementId, false, registerDirty);
  }

  syncFromElement(el: AbstractGraphicElement): void {
    const corners = el.getWorldCorners();
    if (corners.length < 4) return;

    const w = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const h = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
    const angle = (Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) * 180) / Math.PI;

    this.setData(corners[0].x, corners[0].y, w, h, angle);
  }
}
