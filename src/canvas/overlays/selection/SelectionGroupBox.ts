import { BaseSelectionBox } from './BaseSelectionBox';
import type { Group } from '@/core/shapes/group/Group';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { IRenderableNode } from '@/core/type';

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
