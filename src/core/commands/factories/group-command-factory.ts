import type {
  GroupCreateCommand,
  GroupDeleteCommand,
  GroupAddCommand,
  GroupRemoveCommand,
  GroupClearCommand,
} from '../types';

export const createGroupCreateCommand = (
  name?: string,
): GroupCreateCommand => ({
  type: 'GROUP_CREATE',
  options: { name },
});

export const createGroupDeleteCommand = (
  groupId: string,
): GroupDeleteCommand => ({ type: 'GROUP_DELETE', options: { groupId } });

export const createGroupAddCommand = (
  groupId: string,
  elementIds: string[],
): GroupAddCommand => ({
  type: 'GROUP_ADD',
  options: { groupId, elementIds },
});

export const createGroupRemoveCommand = (
  groupId: string,
  elementIds: string[],
): GroupRemoveCommand => ({
  type: 'GROUP_REMOVE',
  options: { groupId, elementIds },
});

export const createGroupClearCommand = (
  groupId: string,
): GroupClearCommand => ({ type: 'GROUP_CLEAR', options: { groupId } });
