import type { PathCommand } from '@/types';
import type { PathElement } from '@/shapes/elements/PathElement';
import { getRenderQueue } from '@/utils/render-queue-utils';

export class PathTimeMachine {
  private path: PathElement;
  private records: PathCommand[][] = [];
  private index = -1;

  public constructor(path: PathElement) {
    this.path = path;
    this.capture();
  }

  public get canUndo(): boolean {
    return this.index > 0;
  }

  public get canRedo(): boolean {
    return this.index < this.records.length - 1;
  }

  public capture(): void {
    const snapshot = this.path.geometry.commands.map((c) => ({
      ...c,
      args: [...c.args],
    }));
    this.records.splice(
      this.index + 1,
      this.records.length - this.index - 1,
      snapshot,
    );
    this.index = this.records.length - 1;
  }

  public undo(): void {
    if (!this.canUndo) return;
    this.index--;
    this.apply();
  }

  public redo(): void {
    if (!this.canRedo) return;
    this.index++;
    this.apply();
  }

  public apply(): void {
    const snapshot = this.records[this.index];
    this.path.geometry.commands = snapshot.map((c) => ({
      ...c,
      args: [...c.args],
    }));
    this.path.rebuildHitArea();
    getRenderQueue()?.add(this.path);
  }

  public getFinalCommands(): PathCommand[] {
    return this.records[this.records.length - 1].map((c) => ({
      ...c,
      args: [...c.args],
    }));
  }

  public getRootCommands(): PathCommand[] {
    return this.records[0].map((c) => ({
      ...c,
      args: [...c.args],
    }));
  }

  public clear(): void {
    this.records = [];
    this.index = -1;
  }
}
