import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { TimeMachine } from '@/time-machine/TimeMachine';
import { PathElement } from '@/shapes/elements/PathElement';

export const createBooleanOperationHandler = (
  shapeManager: ShapeManager,
  timeMachine: TimeMachine,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'BOOLEAN_OPERATION') return;
    const { subjectIds, clipIds, resultCommands, resultFill, resultStroke } = command.options;

    const deletedSnapshots: { id: string; diff: Record<string, unknown> }[] = [];

    for (const id of [...subjectIds, ...clipIds]) {
      const el = shapeManager.getById(id);
      if (el) {
        deletedSnapshots.push({ id, diff: el.toSnapshot() });
        shapeManager.removeElementAndNode(id);
      }
    }

    const newId = crypto.randomUUID();
    const resultEl = new PathElement(newId);
    resultEl.commands = resultCommands;
    resultEl.setFill(resultFill);
    resultEl.setStroke(resultStroke);
    resultEl.setStrokeWidth(2);
    resultEl.buildHitArea();
    resultEl.setDirtyAll();
    shapeManager.addElement(resultEl);

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
