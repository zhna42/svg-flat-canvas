import type { Command } from '@/core/commands/types';
import type { CommandHandler } from '@/core/commands/types';
import type { GroupManager } from '@/manager/GroupManager';

export const createGroupHandler = (
  groupManager: GroupManager,
): CommandHandler => {
  return (command: Command): void => {
    switch (command.type) {
      case 'GROUP_CREATE':
        groupManager.createGroup(command.options.name);
        break;
      case 'GROUP_DELETE':
        groupManager.deleteGroup(command.options.groupId);
        break;
      case 'GROUP_ADD': {
        const { groupId, elementIds } = command.options;
        for (const eid of elementIds) {
          groupManager.addToGroup(groupId, eid);
        }
        break;
      }
      case 'GROUP_REMOVE': {
        const { groupId, elementIds } = command.options;
        for (const eid of elementIds) {
          groupManager.removeFromGroup(groupId, eid);
        }
        break;
      }
      case 'GROUP_CLEAR':
        groupManager.clearGroup(command.options.groupId);
        break;
    }
  };
};
