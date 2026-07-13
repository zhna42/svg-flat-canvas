import type { Command } from '@/core/commands/types';
import type { CommandHandler } from '@/core/commands/types';
import type { ShapeManager } from '@/manager/ShapeManager';
import type { TimeMachine } from '@/manager/time-machine/TimeMachine';
import type { HitTestEngine } from '@/core/hit-test';
import { PathElement } from '@/core/shapes/elements/PathElement';

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
