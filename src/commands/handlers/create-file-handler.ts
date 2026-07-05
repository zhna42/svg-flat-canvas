import type { Command } from '../types';
import type { CommandHandler } from '../types';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { GroupManager } from '@/shapes/group';
import { Group } from '@/shapes/group';

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
