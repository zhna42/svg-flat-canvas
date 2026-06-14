import type { CommandType, CommandSnapshot, SnapshotEntry } from './types';

export class CommandHistory {
  private snapshots: CommandSnapshot[] = [];
  private currentBefore: SnapshotEntry[] = [];
  private currentType: CommandType | null = null;

  public captureBefore(type: { type: CommandType }): void {
    this.currentType = type.type;
    this.currentBefore = [];
  }

  public captureAfter(after: SnapshotEntry[]): void {
    if (this.currentType) {
      this.snapshots.push({
        type: this.currentType,
        before: this.currentBefore,
        after,
      });
    }
    this.currentType = null;
    this.currentBefore = [];
  }

  public push(entry: SnapshotEntry): void {
    this.currentBefore.push(entry);
  }

  public getAll(): readonly CommandSnapshot[] {
    return this.snapshots;
  }

  public clear(): void {
    this.snapshots = [];
    this.currentBefore = [];
    this.currentType = null;
  }
}
