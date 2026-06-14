import type { SvgElement } from '@/shapes/elements/SvgElement';
import { Group, type GroupData } from './Group';
import type { GroupSelectionOverlay } from '@/selection/GroupSelectionOverlay';

export type GroupConflictAction = 'move' | 'cancel';

export class GroupManager {
  private readonly groups = new Map<string, Group>();
  private readonly getElements: () => SvgElement[];
  private readonly overlay: GroupSelectionOverlay;
  private _onChange: (() => void) | null = null;
  public readonly selectedGroupIds = new Set<string>();
  public onGroupSelect: ((ids: string[]) => void) | null = null;
  public onConflict:
    | ((
        elementId: string,
        fromGroup: string,
        toGroup: string,
      ) => GroupConflictAction | null)
    | null = null;
  public conflictSuppressed = false;

  public constructor(
    overlay: GroupSelectionOverlay,
    getElements: () => SvgElement[],
  ) {
    this.overlay = overlay;
    this.getElements = getElements;
  }

  public setOnChange(fn: (() => void) | null): void {
    this._onChange = fn;
  }

  private groupList(): Group[] {
    return Array.from(this.groups.values());
  }

  private updateOverlay(): void {
    const selected = this.groupList().filter((g) =>
      this.selectedGroupIds.has(g.id),
    );
    this.overlay.sync(selected, (id) => this.findElement(id));
  }

  public refreshOverlay(): void {
    this.updateOverlay();
  }

  public setSelectedGroupIds(ids: string[]): void {
    this.selectedGroupIds.clear();
    for (const id of ids) {
      if (this.groups.has(id)) this.selectedGroupIds.add(id);
    }
    this.updateOverlay();
    this.onGroupSelect?.(Array.from(this.selectedGroupIds));
  }

  public clearSelectedGroups(): void {
    this.selectedGroupIds.clear();
    this.updateOverlay();
    this.onGroupSelect?.([]);
  }

  public toggleGroup(id: string): void {
    if (this.selectedGroupIds.has(id)) {
      this.selectedGroupIds.delete(id);
    } else {
      if (this.groups.has(id)) this.selectedGroupIds.add(id);
    }
    this.updateOverlay();
    this.onGroupSelect?.(Array.from(this.selectedGroupIds));
  }

  private notify(): void {
    this.updateOverlay();
    this._onChange?.();
  }

  // ---- CRUD ----

  public createGroup(name?: string): string {
    const id =
      'grp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const g = new Group({
      id,
      name: name || `Group-${this.groups.size + 1}`,
      elementIds: [],
    });
    this.groups.set(id, g);
    this.notify();
    return id;
  }

  public deleteGroup(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    for (const elId of g.elementIds) {
      const el = this.findElement(elId);
      if (el) el.groupId = '';
    }
    this.groups.delete(id);
    this.notify();
  }

  public addToGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g) return;

    const el = this.findElement(elementId);
    if (!el) return;

    // check nesting — groups cannot be added to groups (not applicable for virtual groups)

    // check if already in this group
    if (g.elementIds.has(elementId)) return;

    // check if element already in another group
    if (el.groupId && el.groupId !== groupId) {
      const resolved = this.resolveConflict(elementId, el.groupId, groupId);
      if (resolved === 'cancel') return;
      // 'move' — remove from old group
      const oldGroup = this.groups.get(el.groupId);
      if (oldGroup) {
        oldGroup.elementIds.delete(elementId);
      }
    }

    el.groupId = groupId;
    g.elementIds.add(elementId);
    this.notify();
  }

  public removeFromGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g) return;
    if (!g.elementIds.has(elementId)) return;
    g.elementIds.delete(elementId);
    const el = this.findElement(elementId);
    if (el && el.groupId === groupId) el.groupId = '';
    this.notify();
  }

  public clearGroup(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    for (const elId of g.elementIds) {
      const el = this.findElement(elId);
      if (el && el.groupId === id) el.groupId = '';
    }
    g.elementIds.clear();
    this.notify();
  }

  public getGroup(id: string): Group | undefined {
    return this.groups.get(id);
  }

  public getGroups(): Group[] {
    return Array.from(this.groups.values());
  }

  public getElementIdsInGroup(id: string): string[] {
    const g = this.groups.get(id);
    return g ? Array.from(g.elementIds) : [];
  }

  public getGroupByElement(elementId: string): Group | undefined {
    for (const g of this.groups.values()) {
      if (g.elementIds.has(elementId)) return g;
    }
    return undefined;
  }

  // ---- setGroups (bulk replace from external data) ----

  public setGroups(data: GroupData[]): void {
    this.groups.clear();

    for (const d of data) {
      const validIds = d.elementIds.filter(
        (eid) => this.findElement(eid) !== undefined,
      );
      this.groups.set(d.id, new Group({ ...d, elementIds: validIds }));
    }

    this.notify();
  }

  // ---- conflict resolution ----

  private resolveConflict(
    elementId: string,
    fromGroup: string,
    toGroup: string,
  ): GroupConflictAction {
    if (this.conflictSuppressed) return 'move';

    const result = this.onConflict?.(elementId, fromGroup, toGroup);
    if (result === 'move') return 'move';
    if (result === 'cancel') return 'cancel';

    if (typeof window !== 'undefined') {
      const msg = `Element "${elementId}" is already in group "${fromGroup}". Move it to "${toGroup}"?`;
      return window.confirm(msg) ? 'move' : 'cancel';
    }

    return 'cancel';
  }

  // ---- helpers ----

  private findElement(id: string): SvgElement | undefined {
    return this.getElements().find((e) => e.id === id);
  }

  public destroy(): void {}
}
