import type { DeleteCommand } from '../types';

export function createDeleteCommand(elementIds: string[]): DeleteCommand {
  return { type: 'DELETE', options: { elementIds } };
}
