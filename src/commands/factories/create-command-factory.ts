import type { CreateCommand, CreateFileCommand } from '../types';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export const createCreateCommand = (
  element: AbstractGraphicElement,
): CreateCommand => ({
  type: 'CREATE',
  options: { element },
});

export const createCreateFileCommand = (
  elements: AbstractGraphicElement[],
  groupId: string,
  groupName: string,
): CreateFileCommand => ({
  type: 'CREATE_FILE',
  options: { elements, groupId, groupName },
});
