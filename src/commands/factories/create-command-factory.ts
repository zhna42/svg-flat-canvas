import type { CreateCommand, CreationElementType } from '../types';

export const createCreateCommand = (
  elementType: CreationElementType,
  elementId: string,
  geometry: Record<string, unknown>,
  style: Record<string, unknown>,
): CreateCommand => ({
  type: 'CREATE',
  options: { elementType, elementId, geometry, style },
});
