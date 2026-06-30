import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export const createCreateHandler = (
  shapeManager: ShapeManager,
  indexShape: (el: AbstractGraphicElement) => void,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'CREATE') return;

    const el = command.options.element;
    el.setIsPreview(false);
    el.rebuildHitArea();
    shapeManager.add(el);
    indexShape(el);
    el.setDirtyAll();
  };
};
