import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { Group, type GroupData } from './Group';
import type { EventBus } from '@/core/EventBus';

export type GroupConflictAction = 'move' | 'cancel';

export class GroupManager {
  private readonly groups = new Map<string, Group>();
  private readonly getElements: () => AbstractGraphicElement[];
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
  private events: EventBus | null = null;

  public constructor(
    _overlay: unknown,
    getElements: () => AbstractGraphicElement[],
  ) {
    this.getElements = getElements;
  }

  public setEvents(events: EventBus): void {
    this.events = events;
  }

  public refreshOverlay(): void {}

  public setOnChange(fn: (() => void) | null): void {
    this._onChange = fn;
  }

  public setSelectedGroupIds(ids: string[]): void {
    this.selectedGroupIds.clear();
    for (const id of ids) {
      if (this.groups.has(id)) this.selectedGroupIds.add(id);
    }
    const selected = Array.from(this.selectedGroupIds);
    this.onGroupSelect?.(selected);
    this.events?.emit('GROUP_SELECTION_CHANGED', { ids: selected });
  }

  public clearSelectedGroups(): void {
    this.selectedGroupIds.clear();
    this.onGroupSelect?.([]);
  }

  public toggleGroup(id: string): void {
    if (this.selectedGroupIds.has(id)) {
      this.selectedGroupIds.delete(id);
    } else {
      if (this.groups.has(id)) this.selectedGroupIds.add(id);
    }
    this.onGroupSelect?.(Array.from(this.selectedGroupIds));
  }

  private notify(): void {
    this._onChange?.();
  }

  public createGroup(name?: string): string {
    const id =
      'grp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const groupName = name || `Group-${this.groups.size + 1}`;
    this.groups.set(id, new Group({ id, name: groupName, elementIds: [] }));
    this.events?.emit('GROUP_CREATED', { id, name: groupName });
    this.notify();
    return id;
  }

  public addGroup(group: Group): void {
    this.groups.set(group.id, group);
    this.notify();
  }

  public deleteGroup(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    for (const elId of g.elementIds) {
      const el = this.findElement(elId);
      if (el) el.groupId = '';
    }
    this.groups.delete(id);
    this.events?.emit('GROUP_DELETED', { id });
    this.notify();
  }

  public addToGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g) return;
    const el = this.findElement(elementId);
    if (!el) return;
    if (g.elementIds.has(elementId)) return;
    if (el.groupId && el.groupId !== groupId) {
      if (this.resolveConflict(elementId, el.groupId, groupId) === 'cancel')
        return;
      const oldGroup = this.groups.get(el.groupId);
      if (oldGroup) {
        oldGroup.elementIds.delete(elementId);
        oldGroup.markUnsaved('elementIds');
      }
    }
    el.groupId = groupId;
    g.elementIds.add(elementId);
    g.markUnsaved('elementIds');
    this.events?.emit('GROUP_ELEMENT_ADDED', { groupId, elementId });
    this.notify();
  }

  public removeFromGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g || !g.elementIds.has(elementId)) return;
    g.elementIds.delete(elementId);
    g.markUnsaved('elementIds');
    const el = this.findElement(elementId);
    if (el && el.groupId === groupId) el.groupId = '';
    this.events?.emit('GROUP_ELEMENT_REMOVED', { groupId, elementId });
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
    g.markUnsaved('elementIds');
    this.events?.emit('GROUP_CLEARED', { id });
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

  public setGroups(data: GroupData[]): void {
    for (const g of this.groups.values()) {
      for (const elId of g.elementIds) {
        const el = this.findElement(elId);
        if (el) el.groupId = '';
      }
    }
    this.groups.clear();
    for (const d of data) {
      const validIds = d.elementIds.filter(
        (eid) => this.findElement(eid) !== undefined,
      );
      const group = new Group({ ...d, elementIds: validIds });
      this.groups.set(d.id, group);
      for (const elId of validIds) {
        const el = this.findElement(elId);
        if (el) el.groupId = d.id;
      }
    }
    this.notify();
  }

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
      return window.confirm(
        `Element "${elementId}" is already in group "${fromGroup}". Move it to "${toGroup}"?`,
      )
        ? 'move'
        : 'cancel';
    }
    return 'cancel';
  }

  public loadGroups(data: GroupData[]): void {
    for (const g of this.groups.values()) {
      for (const elId of g.elementIds) {
        const el = this.findElement(elId);
        if (el) el.groupId = '';
      }
    }
    this.groups.clear();
    for (const d of data) {
      const group = new Group({ ...d, elementIds: d.elementIds ?? [] });
      this.groups.set(d.id, group);
      for (const elId of d.elementIds ?? []) {
        const el = this.findElement(elId);
        if (el) el.groupId = d.id;
      }
    }
    this.events?.emit('groups-loaded', data);
    this.notify();
  }

  public addGroups(data: GroupData[]): void {
    for (const d of data) {
      const group = new Group({ ...d, elementIds: d.elementIds ?? [] });
      this.groups.set(d.id, group);
      for (const elId of d.elementIds ?? []) {
        const el = this.findElement(elId);
        if (el) el.groupId = d.id;
      }
    }
    this.events?.emit('groups-added', data);
    this.notify();
  }

  public replaceGroups(data: GroupData[]): void {
    for (const d of data) {
      const old = this.groups.get(d.id);
      if (old) {
        for (const elId of old.elementIds) {
          const el = this.findElement(elId);
          if (el) el.groupId = '';
        }
        this.groups.delete(d.id);
      }
      const group = new Group({ ...d, elementIds: d.elementIds ?? [] });
      this.groups.set(d.id, group);
      for (const elId of d.elementIds ?? []) {
        const el = this.findElement(elId);
        if (el) el.groupId = d.id;
      }
    }
    this.events?.emit('groups-replaced', data);
    this.notify();
  }

  public updateGroups(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    for (const { id, fields } of patches) {
      const g = this.groups.get(id);
      if (g) g.applyDTO(fields);
    }
    this.events?.emit('groups-updated', patches);
    this.notify();
  }

  public getUnsavedDTOs(): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];
    for (const g of this.groups.values()) {
      const dto = g.getUnsavedDTO();
      if (dto) result.push(dto);
    }
    return result;
  }

  private findElement(id: string): AbstractGraphicElement | undefined {
    return this.getElements().find((e) => e.id === id);
  }
  public destroy(): void {}
}
