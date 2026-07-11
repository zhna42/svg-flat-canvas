import type { Command } from '../types';
import type { CommandHandler } from '../types';
import type { ShapeManager } from '@/manager/ShapeManager';
import type { HitTestEngine } from '@/core/hit-test';

export const createDeleteHandler = (
  shapeManager: ShapeManager,
  hitTestEngine: HitTestEngine,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'DELETE') return;
    const { elementIds } = command.options;
    for (const id of elementIds) {
      hitTestEngine.remove(id);
      shapeManager.remove(id);
    }
  };
};
