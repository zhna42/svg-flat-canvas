import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { GroupManager } from '@/group/GroupManager';

export function createGroupHandler(groupManager: GroupManager): CommandHandler {
  return (command: Command): { affected: { kind: 'group' | 'element'; id: string }[] } | void => {
    switch (command.type) {
      case 'GROUP_CREATE': {
        const id = groupManager.createGroup(command.options.name);
        return { affected: [{ kind: 'group', id }] };
      }
      case 'GROUP_DELETE': {
        groupManager.deleteGroup(command.options.groupId);
        return { affected: [{ kind: 'group', id: command.options.groupId }] };
      }
      case 'GROUP_ADD': {
        const { groupId, elementIds } = command.options;
        for (const eid of elementIds) {
          groupManager.addToGroup(groupId, eid);
        }
        return {
          affected: [
            { kind: 'group', id: groupId },
            ...elementIds.map((id: string) => ({ kind: 'element' as const, id })),
          ],
        };
      }
      case 'GROUP_REMOVE': {
        const { groupId, elementIds } = command.options;
        for (const eid of elementIds) {
          groupManager.removeFromGroup(groupId, eid);
        }
        return {
          affected: [
            { kind: 'group', id: groupId },
            ...elementIds.map((id: string) => ({ kind: 'element' as const, id })),
          ],
        };
      }
      case 'GROUP_CLEAR': {
        groupManager.clearGroup(command.options.groupId);
        return { affected: [{ kind: 'group', id: command.options.groupId }] };
      }
    }
  };
}
