import type { DeleteCommand } from '../types';

export const createDeleteCommand = (elementIds: string[]): DeleteCommand => ({
  type: 'DELETE',
  options: { elementIds },
});
