import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { SpatialGrid } from '@/math/spatial/SpatialGrid';

export const createDeleteHandler = (
  shapeManager: ShapeManager,
  spatialGrid: SpatialGrid,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'DELETE') return;
    const { elementIds } = command.options;
    for (const id of elementIds) {
      const el = shapeManager.getById(id);
      if (el) {
        spatialGrid.removeById(id, el.getSpatialCellIds());
      }
      shapeManager.remove(id);
    }
  };
};
