import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export type SelectionFilter = (
  elements: AbstractGraphicElement[],
) => AbstractGraphicElement[];
