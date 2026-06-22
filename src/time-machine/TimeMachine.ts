import type { SnapshotCommand, TimeSnapshot, EntityDiff } from './types';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { ShapeManager } from '@/shapes/ShapeManager';
import { createElementByType } from '@/shapes/elements/factory';

export type { TimeSnapshot } from './types';

export class TimeMachine {
  private records: TimeSnapshot[] = [];
  private index = -1;
  private readonly maxRecords: number;
  private readonly shapeManager: ShapeManager;
  private onUpdate: (() => void) | null = null;

  public constructor(shapeManager: ShapeManager, maxRecords = 100) {
    this.shapeManager = shapeManager;
    this.maxRecords = maxRecords;
  }

  public setOnUpdate(fn: (() => void) | null): void {
    this.onUpdate = fn;
  }

  public get canUndo(): boolean {
    return this.index >= 0;
  }

  public get canRedo(): boolean {
    return this.index < this.records.length - 1;
  }

  public get currentIndex(): number {
    return this.index;
  }

  public get totalRecords(): number {
    return this.records.length;
  }

  public getAllRecords(): TimeSnapshot[] {
    return [...this.records];
  }

  public push(
    command: SnapshotCommand,
    selectIds: string[],
    selectType: 'element' | 'group',
    getFullSnapshotIds: string[],
    getDiffElements: AbstractGraphicElement[],
  ): void {
    const data: EntityDiff[] = [];

    for (const id of getFullSnapshotIds) {
      const el = this.shapeManager.getById(id);
      if (el) {
        data.push({ id, diff: el.получитьCнимокFull() });
      }
    }

    for (const el of getDiffElements) {
      if (getFullSnapshotIds.includes(el.id)) continue;
      const diff = el.получитьCнимокDiff();
      if (Object.keys(diff).length > 0) {
        data.push({ id: el.id, diff });
      }
    }

    this.index++;
    this.records.length = this.index;
    this.records.push({ command, selectIds, selectType, data });
    if (this.records.length > this.maxRecords) {
      this.records.shift();
      this.index--;
    }
    this.onUpdate?.();
  }

  public undo(): void {
    if (!this.canUndo) return;
    const snapshot = this.records[this.index];
    this.index--;
    this.applySnapshot(snapshot, true);
    this.onUpdate?.();
  }

  public redo(): void {
    if (!this.canRedo) return;
    this.index++;
    const snapshot = this.records[this.index];
    this.applySnapshot(snapshot, false);
    this.onUpdate?.();
  }

  public clear(): void {
    this.records = [];
    this.index = -1;
    this.onUpdate?.();
  }

  public toJSON(): TimeSnapshot[] {
    return this.records;
  }

  public fromJSON(records: TimeSnapshot[]): void {
    this.records = records;
    this.index = records.length - 1;
  }

  private applySnapshot(snapshot: TimeSnapshot, isUndo: boolean): void {
    const create = isUndo ? (snapshot.command === 'DELETE') : (snapshot.command === 'CREATE' || snapshot.command === 'CREATE_FILE');
    const remove = isUndo ? (snapshot.command === 'CREATE' || snapshot.command === 'CREATE_FILE') : (snapshot.command === 'DELETE');

    for (const entry of snapshot.data) {
      if (create) {
        const el = createElementByType(entry.diff.type as string, entry.id);
        if (el) {
          el.applyCнимок(entry.diff);
          this.shapeManager.addElement(el);
        }
      } else if (remove) {
        this.shapeManager.removeElementAndNode(entry.id);
      } else {
        const el = this.shapeManager.getById(entry.id);
        if (el) {
          el.applyCнимок(entry.diff);
        }
      }
    }
  }
}
