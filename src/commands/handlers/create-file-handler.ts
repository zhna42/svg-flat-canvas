import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { GroupManager } from '@/group';
import { Group } from '@/group';

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
      el.setDirty();
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