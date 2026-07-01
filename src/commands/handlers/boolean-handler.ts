import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { TimeMachine } from '@/time-machine/TimeMachine';
import type { SpatialGrid } from '@/spatial/SpatialGrid';
import { PathElement } from '@/shapes/elements/PathElement';
import { getRenderQueue } from '@/utils/render-queue-utils';

export const createBooleanOperationHandler = (
  shapeManager: ShapeManager,
  timeMachine: TimeMachine,
  spatialGrid: SpatialGrid,
  onIndexElement: (el: PathElement) => void,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'BOOLEAN_OPERATION') return;
    const { subjectIds, clipIds, resultCommands, resultFill, resultStroke } =
      command.options;

    const deletedSnapshots: { id: string; diff: Record<string, unknown> }[] =
      [];

    for (const id of [...subjectIds, ...clipIds]) {
      const el = shapeManager.getById(id);
      if (el) {
        deletedSnapshots.push({ id, diff: el.toSnapshot() });
        const oldIds = el.getSpatialCellIds();
        spatialGrid.removeById(id, oldIds);
        shapeManager.removeElementAndNode(id);
      }
    }

    const newId = crypto.randomUUID();
    const resultEl = new PathElement(newId);
    resultEl.commands = resultCommands;
    resultEl.style.fill = resultFill;
    resultEl.style.stroke = resultStroke;
    resultEl.style.strokeWidth = 2;
    resultEl.rebuildHitArea();
    getRenderQueue()?.add(resultEl);
    shapeManager.addElement(resultEl);

    const bbox = resultEl.getTransformedBBox();
    const cellIds = spatialGrid.insert(
      resultEl.id,
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
    );
    resultEl.setSpatialCellIds(cellIds);
    onIndexElement(resultEl);

    timeMachine.push(
      'BOOLEAN_OPERATION',
      [newId],
      'element',
      [newId],
      [],
      deletedSnapshots,
    );
  };
};
