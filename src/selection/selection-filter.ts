import type { SvgElement } from '@/shapes/elements/SvgElement';

export type SelectionFilter = (elements: SvgElement[]) => SvgElement[];
