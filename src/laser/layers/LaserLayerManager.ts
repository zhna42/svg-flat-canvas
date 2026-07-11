import type { EventBus } from '@/core/EventBus';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { UseElement } from '@/shapes/elements/UseElement';
import type { LaserGroupManager } from '../LaserGroupManager';
import { LaserLayer } from './LaserLayer';
import type {
  LaserLayerData,
  LaserLayerCreateDTO,
  LaserLayerGroupInfo,
} from './types';

export class LaserLayerManager {
  private readonly layers = new Map<string, LaserLayer>();
  private readonly groupManager: LaserGroupManager;
  private readonly getElements: () => AbstractGraphicElement[];
  private events: EventBus | null = null;
  private _onChange: (() => void) | null = null;

  constructor(
    groupManager: LaserGroupManager,
    getElements: () => AbstractGraphicElement[],
  ) {
    this.groupManager = groupManager;
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

  public createLayer(dto?: LaserLayerCreateDTO): string {
    const id =
      'layer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const layer = new LaserLayer({ id, ...dto });
    this.layers.set(id, layer);
    this.events?.emit('LASER_LAYER_CREATED', { id, layer: layer.toData() });
    this.notify();
    return id;
  }

  public deleteLayer(id: string): void {
    this.layers.delete(id);
    this.events?.emit('LASER_LAYER_DELETED', { id });
    this.notify();
  }

  public updateLayer(
    id: string,
    fields: Partial<LaserLayerData>,
  ): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    if (fields.name !== undefined) layer.name = fields.name;
    if (fields.visible !== undefined) layer.visible = fields.visible;
    if (fields.groupIds !== undefined) {
      layer.groupIds.clear();
      for (const gid of fields.groupIds) layer.groupIds.add(gid);
    }
    this.events?.emit('LASER_LAYER_UPDATED', { id, fields });
    this.notify();
  }

  public addGroupToLayer(layerId: string, groupId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;
    const group = this.groupManager.getGroup(groupId);
    if (!group) return;
    layer.groupIds.add(groupId);
    this.events?.emit('LASER_LAYER_GROUP_ADDED', { layerId, groupId });
    this.notify();
  }

  public removeGroupFromLayer(layerId: string, groupId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;
    layer.groupIds.delete(groupId);
    this.events?.emit('LASER_LAYER_GROUP_REMOVED', { layerId, groupId });
    this.notify();
  }

  public setLayerVisibility(id: string, visible: boolean): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.visible = visible;
    this.events?.emit('LASER_LAYER_UPDATED', { id, fields: { visible } });
    this.notify();
  }

  public getLayer(id: string): LaserLayer | undefined {
    return this.layers.get(id);
  }

  public getLayers(): LaserLayer[] {
    return Array.from(this.layers.values());
  }

  public getLayerData(): LaserLayerData[] {
    return Array.from(this.layers.values()).map((l) => l.toData());
  }

  /** Получить информацию о группах внутри слоя с разрешёнными ID элементов. */
  public getLayerGroupInfo(layerId: string): LaserLayerGroupInfo[] {
    const layer = this.layers.get(layerId);
    if (!layer) return [];

    return Array.from(layer.groupIds)
      .map((gid) => {
        const group = this.groupManager.getGroup(gid);
        if (!group) return null;
        const elementIds = Array.from(group.elementIds);
        const resolved = this.resolveElements(elementIds);
        return {
          groupId: group.id,
          groupName: group.name,
          type: group.type,
          elementIds,
          resolvedElementIds: resolved,
        };
      })
      .filter((info): info is LaserLayerGroupInfo => info !== null);
  }

  /**
   * Разрешить use-элементы: для каждого ID находим все use-элементы, ссылающиеся на него.
   * Группа применяется к оригиналу и его use-копиям.
   * Глубокие копии (не use-элементы) — самостоятельные.
   */
  public resolveElements(elementIds: string[]): string[] {
    const resolved = new Set(elementIds);
    const all = this.getElements();

    for (const useEl of all) {
      if (useEl instanceof UseElement && useEl.refId) {
        const rootId = this.resolveRoot(useEl.refId);
        if (resolved.has(rootId)) {
          resolved.add(useEl.id);
        }
      }
    }

    return Array.from(resolved);
  }

  private resolveRoot(id: string): string {
    const elements = this.getElements();
    let current = elements.find((e) => e.id === id);
    while (current instanceof UseElement && current.refId) {
      const parent = elements.find((e) => e.id === current!.refId);
      if (!parent || parent.id === current.id) break;
      current = parent;
    }
    return current?.id ?? id;
  }

  public loadLayers(data: LaserLayerData[]): void {
    this.layers.clear();
    for (const d of data) {
      const layer = new LaserLayer(d);
      this.layers.set(d.id, layer);
    }
    this.notify();
  }

  public destroy(): void {
    this.layers.clear();
  }
}
