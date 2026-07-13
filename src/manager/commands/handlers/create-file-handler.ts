import type { Command } from '@/core/commands/types';
import type { CommandHandler } from '@/core/commands/types';
import type { ShapeManager } from '@/manager/ShapeManager';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { GroupManager } from '@/manager/GroupManager';
import { Group } from '@/core/shapes/group';

export const createCreateFileHandler = (
  shapeManager: ShapeManager,
  groupManager: GroupManager,
  indexShape: (el: AbstractGraphicElement) => void,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'CREATE_FILE') return;

    const { elements, groupId, groupName } = command.options;

    for (const el of elements) {
      el.isPreview = false;
      shapeManager.add(el);
      indexShape(el);
      el.groupId = groupId;
    }

    groupManager.addGroup(
      new Group({
        id: groupId,
        name: groupName,
        elementIds: elements.map((el) => el.id),
      }),
    );
  };
};
