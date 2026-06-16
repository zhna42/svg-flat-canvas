import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';

export function createDeleteHandler(
  shapeManager: ShapeManager,
): CommandHandler {
  return (command: Command): void => {
    if (command.type !== 'DELETE') return;
    const { elementIds } = command.options;
    for (const id of elementIds) {
      shapeManager.remove(id);
    }
  };
}
