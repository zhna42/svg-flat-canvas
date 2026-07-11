import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { EventBus } from '@/core/event-bus/EventBus';
import { LaserGroup } from '@/modules/laser/LaserGroup';
import type {
  LaserGroupData,
  LaserGroupFields,
  LaserGroupCreateDTO,
} from '@/modules/laser/laser-types';

export class LaserGroupManager {
  private readonly groups = new Map<string, LaserGroup>();
  private readonly getElements: () => AbstractGraphicElement[];
  private _onChange: (() => void) | null = null;
  private events: EventBus | null = null;
  public conflictSuppressed = true;

  /** Снять элементы с выделения (для selectable/visible=false). */
  public onDeselectElements: ((ids: string[]) => void) | null = null;

  public constructor(getElements: () => AbstractGraphicElement[]) {
    this.getElements = getElements;
  }

  public setEvents(events: EventBus): void {
    this.events = events;
  }
  public setOnChange(fn: (() => void) | null): void {
    this._onChange = fn;
  }
  private notify(): void {
    this._onChange?.();
  }
  private findElement(id: string): AbstractGraphicElement | undefined {
    return this.getElements().find((e) => e.id === id);
  }

  // ── CRUD ──

  public createGroup(dto?: LaserGroupCreateDTO): string {
    const id =
      'laser-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const name = dto?.name || `Laser-${this.groups.size + 1}`;
    const group = new LaserGroup({ id, name, ...dto });
    this.groups.set(id, group);
    this.events?.emit('LASER_GROUP_CREATED', { id, group: group.toData() });
    this.notify();
    return id;
  }

  public deleteGroup(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    for (const elId of g.elementIds) this.unlinkElement(elId, id);
    this.groups.delete(id);
    this.events?.emit('LASER_GROUP_DELETED', { id });
    this.notify();
  }

  public addToGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g) return;
    const el = this.findElement(elementId);
    if (!el) return;
    if (g.elementIds.has(elementId)) return;

    // Элемент с гибким деревом — только в группу резки.
    if (el.flexTree && g.type !== 'cut') return;

    const prevId = el.laserProps.laserGroupId;
    if (prevId && prevId !== groupId) {
      const prev = this.groups.get(prevId);
      if (prev) {
        prev.elementIds.delete(elementId);
        prev.markUnsaved('elementIds');
      }
    }
    el.laserProps.laserGroupId = groupId;
    el.laserProps.laserType = g.type;
    g.elementIds.add(elementId);
    g.markUnsaved('elementIds');

    if (!g.selectable || !g.visible) this.onDeselectElements?.([elementId]);
    this.events?.emit('LASER_GROUP_ELEMENT_ADDED', { groupId, elementId });
    this.notify();
  }

  public removeFromGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g || !g.elementIds.has(elementId)) return;
    g.elementIds.delete(elementId);
    g.markUnsaved('elementIds');
    this.unlinkElement(elementId, groupId);
    this.events?.emit('LASER_GROUP_ELEMENT_REMOVED', { groupId, elementId });
    this.notify();
  }

  public clearGroup(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    for (const elId of g.elementIds) this.unlinkElement(elId, id);
    g.elementIds.clear();
    g.markUnsaved('elementIds');
    this.events?.emit('LASER_GROUP_CLEARED', { id });
    this.notify();
  }

  public updateGroup(id: string, fields: LaserGroupFields): void {
    const g = this.groups.get(id);
    if (!g) return;
    // Нельзя сменить тип на не-резку, если в группе есть элементы с flexTree.
    if (fields.type !== undefined && fields.type !== 'cut') {
      for (const elId of g.elementIds) {
        if (this.findElement(elId)?.flexTree) {
          fields = { ...fields };
          delete fields.type;
          break;
        }
      }
    }
    g.applyFields(fields);
    // Синхронизируем тип на элементах
    if (fields.type !== undefined) {
      for (const elId of g.elementIds) {
        const el = this.findElement(elId);
        if (el) el.laserProps.laserType = g.type;
      }
    }
    if (fields.selectable === false || fields.visible === false) {
      this.onDeselectElements?.(Array.from(g.elementIds));
    }
    this.events?.emit('LASER_GROUP_UPDATED', { id, fields });
    this.notify();
  }

  private unlinkElement(elementId: string, groupId: string): void {
    const el = this.findElement(elementId);
    if (el && el.laserProps.laserGroupId === groupId) {
      el.laserProps.laserGroupId = '';
      el.laserProps.laserType = '';
    }
  }

  /** Удалить элемент из его лазер-группы (при удалении фигуры). */
  public purgeElement(elementId: string): void {
    const g = this.getGroupByElement(elementId);
    if (g) {
      g.elementIds.delete(elementId);
      g.markUnsaved('elementIds');
      this.notify();
    }
  }

  // ── Queries ──

  public getGroup(id: string): LaserGroup | undefined {
    return this.groups.get(id);
  }
  public getGroups(): LaserGroup[] {
    return Array.from(this.groups.values());
  }
  public getElementIdsInGroup(id: string): string[] {
    const g = this.groups.get(id);
    return g ? Array.from(g.elementIds) : [];
  }
  public getGroupByElement(elementId: string): LaserGroup | undefined {
    for (const g of this.groups.values()) {
      if (g.elementIds.has(elementId)) return g;
    }
    return undefined;
  }

  /** Можно ли выделять/хитать элемент (selectable && visible). */
  public canInteract(elementId: string): boolean {
    const g = this.getGroupByElement(elementId);
    if (!g) return true;
    return g.selectable && g.visible;
  }

  /** Можно ли двигать элемент. */
  public canMove(elementId: string): boolean {
    const g = this.getGroupByElement(elementId);
    return g ? g.movable : true;
  }

  // ── Persistence ──

  public loadGroups(data: LaserGroupData[]): void {
    for (const g of this.groups.values()) {
      for (const elId of g.elementIds) this.unlinkElement(elId, g.id);
    }
    this.groups.clear();
    for (const d of data) this.addGroupData(d);
    this.events?.emit('laser-groups-loaded', data);
    this.notify();
  }

  public addGroups(data: LaserGroupData[]): void {
    for (const d of data) this.addGroupData(d);
    this.events?.emit('laser-groups-added', data);
    this.notify();
  }

  public replaceGroups(data: LaserGroupData[]): void {
    for (const d of data) {
      const old = this.groups.get(d.id);
      if (old) {
        for (const elId of old.elementIds) this.unlinkElement(elId, d.id);
        this.groups.delete(d.id);
      }
      this.addGroupData(d);
    }
    this.events?.emit('laser-groups-replaced', data);
    this.notify();
  }

  public updateGroups(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    for (const { id, fields } of patches) {
      this.groups.get(id)?.applyDTO(fields);
    }
    this.events?.emit('laser-groups-updated', patches);
    this.notify();
  }

  public getUnsavedDTOs(): Array<Record<string, unknown>> {
    const out: Array<Record<string, unknown>> = [];
    for (const g of this.groups.values()) {
      const dto = g.getUnsavedDTO();
      if (dto) out.push(dto);
    }
    return out;
  }

  private addGroupData(d: LaserGroupData): void {
    const validIds = (d.elementIds ?? []).filter(
      (eid) => this.findElement(eid) !== undefined,
    );
    const group = new LaserGroup({ ...d, elementIds: validIds });
    this.groups.set(d.id, group);
    for (const elId of validIds) {
      const el = this.findElement(elId);
      if (el) {
        el.laserProps.laserGroupId = d.id;
        el.laserProps.laserType = group.type;
      }
    }
  }

  public destroy(): void {
    this.groups.clear();
  }
}
