import { BaseSelectionBox } from './BaseSelectionBox';
import type { Group } from '@/shapes/group/Group';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { IRenderableNode } from '@/types';

export class SelectionGroupBox extends BaseSelectionBox {
  constructor(groupId: string, registerDirty: (node: IRenderableNode) => void) {
    super(`sel-grp-${groupId}`, groupId, true, registerDirty);
  }

  syncFromGroup(
    group: Group,
    getElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    const bbox = group.getWorldBBox(getElement);
    if (!bbox) return;

    let angle = 0;
    if (!group.matrix.isIdentity) {
      const m = group.matrix;
      const det = m.a * m.d - m.b * m.c;
      if (Math.abs(det) > 1e-10) {
        angle = (Math.atan2(m.b, m.a) * 180) / Math.PI;
      }
    }

    this.setData(bbox.x, bbox.y, bbox.width, bbox.height, angle);
  }
}
