import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { TimeMachine } from '@/time-machine/TimeMachine';
import type { HitTestEngine } from '@/core/HitTestEngine';
import { PathElement } from '@/shapes/elements/PathElement';

export const createBooleanOperationHandler = (
  shapeManager: ShapeManager,
  timeMachine: TimeMachine,
  hitTestEngine: HitTestEngine,
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
        hitTestEngine.remove(id);
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
    shapeManager.addElement(resultEl);

    hitTestEngine.insert(resultEl);
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
