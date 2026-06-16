import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';

export const createCreateHandler = (
  shapeManager: ShapeManager,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'CREATE') return;

    const el = command.options.element;
    el.isPreview = false;
    shapeManager.add(el);
    el.setDirty();
  };
};
