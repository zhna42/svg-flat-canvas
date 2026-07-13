import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { ShapeManager } from '../ShapeManager';
import type { SnapshotCommand, TimeSnapshot, EntityDiff } from '@/core/type';
import { createElementByType } from '@/core/shapes/factory';

export class TimeMachine {
  private root: TimeSnapshot | null = null;
  private records: TimeSnapshot[] = [];
  private index = -1;
  private readonly maxRecords: number;
  private readonly shapeManager: ShapeManager;
  private onUpdate: (() => void) | null = null;
  public suppressTimeMachine = false;

  public constructor(shapeManager: ShapeManager, maxRecords = 100) {
    this.shapeManager = shapeManager;
    this.maxRecords = maxRecords;
  }

  public setOnUpdate(fn: (() => void) | null): void {
    this.onUpdate = fn;
  }

  public get canUndo(): boolean {
    if (this.records.length === 0) return false;
    if (this.root) return this.index >= 0;
    return this.index > 0;
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

  public captureRoot(): void {
    const data: EntityDiff[] = [];
    for (const el of this.shapeManager.getAll()) {
      data.push({ id: el.id, diff: el.getFullData() });
    }
    this.root = { command: 'ROOT', selectIds: [], selectType: 'element', data };
    this.records = [];
    this.index = -1;
  }

  public push(
    command: SnapshotCommand,
    selectIds: string[],
    selectType: 'element' | 'group',
    getFullSnapshotIds: string[],
    getDiffElements: AbstractGraphicElement[],
    deletedSnapshots?: EntityDiff[],
  ): void {
    if (!this.root && this.records.length === 0) {
      this.captureRoot();
    }

    const data: EntityDiff[] = [];

    for (const id of getFullSnapshotIds) {
      const el = this.shapeManager.getById(id);
      if (el) {
        data.push({ id, diff: el.getFullData() });
      }
    }

    for (const el of getDiffElements) {
      if (getFullSnapshotIds.includes(el.id)) continue;
      const diff = el.getDiffSnapshot();
      if (Object.keys(diff).length > 0) {
        data.push({ id: el.id, diff });
      }
    }

    if (deletedSnapshots) {
      for (const ds of deletedSnapshots) {
        data.push(ds);
      }
    }

    const entry: TimeSnapshot = { command, selectIds, selectType, data };
    this.records.splice(
      this.index + 1,
      this.records.length - this.index - 1,
      entry,
    );
    this.index++;

    if (this.records.length > this.maxRecords) {
      this.records.shift();
      this.index--;
    }
    this.onUpdate?.();
    this.log('push');
  }

  private log(action: string): void {
    const lines: string[] = [];
    lines.push(`── TimeMachine ${action} ──`);
    lines.push(
      `  root: ${this.root ? `ROOT (${this.root.data.length} elements)` : 'null'}`,
    );
    lines.push(`  index: ${this.index}`);
    lines.push(`  records[${this.records.length}]:`);
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      const prefix = i === this.index ? ' →' : '  ';
      lines.push(
        `  ${prefix} [${i}] ${r.command} select:[${r.selectIds.join(',')}] data:[`,
      );
      for (const d of r.data) {
        lines.push(`       ${d.id}: ${JSON.stringify(d.diff)}`);
      }
      lines.push(`    ]`);
    }
  }

  public undo(): void {
    if (!this.canUndo) return;

    const current = this.records[this.index];
    this.index--;

    if (this.index === -1) {
      if (this.root) this.applyState(this.root);
    } else {
      this.applyState(this.records[this.index]);
    }

    this.reverseCommand(current);
    this.onUpdate?.();
    this.log('undo');
  }

  public redo(): void {
    if (!this.canRedo) return;
    this.index++;
    const snapshot = this.records[this.index];
    this.applyState(snapshot);
    this.forwardCommand(snapshot);
    this.onUpdate?.();
    this.log('redo');
  }

  public clear(): void {
    this.root = null;
    this.records = [];
    this.index = -1;
    this.onUpdate?.();
  }

  public resetToRoot(): void {
    if (this.root) {
      const restore = this.root;
      this.records = [];
      this.index = -1;
      this.applyState(restore);
    }
    this.onUpdate?.();
  }

  public toJSON(): TimeSnapshot[] {
    if (this.root) return [this.root, ...this.records];
    return this.records;
  }

  public fromJSON(records: TimeSnapshot[]): void {
    if (records.length > 0 && records[0].command === 'ROOT') {
      this.root = records[0];
      this.records = records.slice(1);
    } else {
      this.root = null;
      this.records = records;
    }
    this.index = this.records.length - 1;
    this.log('fromJSON');
  }

  private applyState(snapshot: TimeSnapshot): void {
    for (const entry of snapshot.data) {
      const existing = this.shapeManager.getById(entry.id);
      if (existing) {
        existing.applySnapshot(entry.diff);
      }
    }
  }

  private reverseCommand(snapshot: TimeSnapshot): void {
    if (snapshot.command === 'CREATE' || snapshot.command === 'CREATE_FILE') {
      for (const entry of snapshot.data) {
        this.shapeManager.removeElementAndNode(entry.id);
      }
    } else if (snapshot.command === 'DELETE') {
      for (const entry of snapshot.data) {
        const el = createElementByType(entry.diff.type as string, entry.id);
        if (el) {
          el.applySnapshot(entry.diff);
          el.rebuildHitArea();
          this.shapeManager.addElement(el);
        }
      }
    } else if (snapshot.command === 'BOOLEAN_OPERATION') {
      for (const entry of snapshot.data) {
        const existing = this.shapeManager.getById(entry.id);
        if (existing) {
          this.shapeManager.removeElementAndNode(entry.id);
        } else {
          const el = createElementByType(entry.diff.type as string, entry.id);
          if (el) {
            el.applySnapshot(entry.diff);
            el.rebuildHitArea();
            this.shapeManager.addElement(el);
          }
        }
      }
    } else if (snapshot.command === 'UPDATE') {
      for (const entry of snapshot.data) {
        const existing = this.shapeManager.getById(entry.id);
        if (existing) existing.applySnapshot(entry.diff);
      }
    }
  }

  private forwardCommand(snapshot: TimeSnapshot): void {
    if (snapshot.command === 'CREATE' || snapshot.command === 'CREATE_FILE') {
      for (const entry of snapshot.data) {
        const el = createElementByType(entry.diff.type as string, entry.id);
        if (el) {
          el.applySnapshot(entry.diff);
          el.rebuildHitArea();
          this.shapeManager.addElement(el);
        }
      }
    } else if (snapshot.command === 'DELETE') {
      for (const entry of snapshot.data) {
        this.shapeManager.removeElementAndNode(entry.id);
      }
    } else if (snapshot.command === 'BOOLEAN_OPERATION') {
      for (const entry of snapshot.data) {
        const existing = this.shapeManager.getById(entry.id);
        if (existing) {
          this.shapeManager.removeElementAndNode(entry.id);
        } else {
          const el = createElementByType(entry.diff.type as string, entry.id);
          if (el) {
            el.applySnapshot(entry.diff);
            el.rebuildHitArea();
            this.shapeManager.addElement(el);
          }
        }
      }
    } else if (snapshot.command === 'UPDATE') {
      for (const entry of snapshot.data) {
        const existing = this.shapeManager.getById(entry.id);
        if (existing) existing.applySnapshot(entry.diff);
      }
    }
  }
}
