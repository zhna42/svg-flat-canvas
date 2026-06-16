import type { CreateCommand } from '../types';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export const createCreateCommand = (
  element: AbstractGraphicElement,
): CreateCommand => ({
  type: 'CREATE',
  options: { element },
});
