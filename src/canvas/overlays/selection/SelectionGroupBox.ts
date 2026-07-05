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
    const obb = group.getOrientedBBox(getElement);
    if (!obb) return;
    this.setData(obb.x, obb.y, obb.width, obb.height, obb.angle);
  }
}
