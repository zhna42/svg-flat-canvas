import type {
  GroupCreateCommand,
  GroupDeleteCommand,
  GroupAddCommand,
  GroupRemoveCommand,
  GroupClearCommand,
} from '../types';

export function createGroupCreateCommand(name?: string): GroupCreateCommand {
  return { type: 'GROUP_CREATE', options: { name } };
}

export function createGroupDeleteCommand(groupId: string): GroupDeleteCommand {
  return { type: 'GROUP_DELETE', options: { groupId } };
}

export function createGroupAddCommand(
  groupId: string,
  elementIds: string[],
): GroupAddCommand {
  return { type: 'GROUP_ADD', options: { groupId, elementIds } };
}

export function createGroupRemoveCommand(
  groupId: string,
  elementIds: string[],
): GroupRemoveCommand {
  return { type: 'GROUP_REMOVE', options: { groupId, elementIds } };
}

export function createGroupClearCommand(groupId: string): GroupClearCommand {
  return { type: 'GROUP_CLEAR', options: { groupId } };
}
