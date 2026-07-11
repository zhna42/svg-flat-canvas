import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { TimeSnapshot } from '@/core/type';

export class HistoryController {
  constructor(private canvas: SvgCanvas) {}

  undo(): void {
    if (this.canvas.nodeEdit.isActive) return;
    this.canvas.selectionState.clear();
    this.canvas.groupManager.clearSelectedGroups();
    this.canvas.selectionManager.clear();
    this.canvas.timeMachine.undo();
    this.canvas.elementManager.reindexAll();
  }

  redo(): void {
    if (this.canvas.nodeEdit.isActive) return;
    this.canvas.selectionState.clear();
    this.canvas.groupManager.clearSelectedGroups();
    this.canvas.selectionManager.clear();
    this.canvas.timeMachine.redo();
    this.canvas.elementManager.reindexAll();
  }

  get canUndo(): boolean {
    return this.canvas.timeMachine.canUndo;
  }

  get canRedo(): boolean {
    return this.canvas.timeMachine.canRedo;
  }

  saveTimeMachine(): TimeSnapshot[] {
    return this.canvas.timeMachine.toJSON();
  }

  loadTimeMachine(records: TimeSnapshot[]): void {
    this.canvas.shapeManager.clear();
    this.canvas.groupManager.setGroups([]);
    this.canvas.hitTestEngine.reindexAll([]);
    this.canvas.timeMachine.fromJSON(records);
  }
}
