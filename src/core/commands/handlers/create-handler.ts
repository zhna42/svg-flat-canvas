import type { Command } from '../types';
import type { CommandHandler } from '../types';
import type { ShapeManager } from '@/manager/ShapeManager';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';

export const createCreateHandler = (
  shapeManager: ShapeManager,
  indexShape: (el: AbstractGraphicElement) => void,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'CREATE') return;

    const el = command.options.element;
    el.isPreview = false;
    el.rebuildHitArea();
    shapeManager.add(el);
    indexShape(el);
  };
};
