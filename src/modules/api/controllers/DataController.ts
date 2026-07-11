import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { ElementJSON, ElementType } from '@/core/type';
import { createFromJSONArray } from '@/core/shapes/factory';

let _idCounter = 0;
const generateId = (): string =>
  crypto.randomUUID?.() ?? `shape_${Date.now()}_${++_idCounter}`;

export class DataController {
  constructor(private canvas: SvgCanvas) {}

  loadJSON(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.canvas.elementManager.addShape(el);
    }
    this.canvas.timeMachine.clear();
  }

  getUnsavedDTOs(): Array<Record<string, unknown>> {
    return this.canvas.elementManager.getUnsavedDTOs();
  }

  getUnsavedGroupDTOs(): Array<Record<string, unknown>> {
    return this.canvas.groupManager.getUnsavedDTOs();
  }

  loadElements(dtos: Record<string, unknown>[]): void {
    this.canvas.elementManager.loadElements(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        type: d.type as ElementType,
        attributes: (d.attributes ?? d) as Record<string, string>,
        groupId: d.groupId as string | undefined,
        name: d.name as string | undefined,
        visible: d.visible as boolean | undefined,
        lock: d.lock as boolean | undefined,
        data: d.data as Record<string, unknown> | undefined,
      })),
    );
  }

  addElements(dtos: Record<string, unknown>[]): void {
    this.canvas.elementManager.addElements(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        type: d.type as ElementType,
        attributes: (d.attributes ?? d) as Record<string, string>,
        groupId: d.groupId as string | undefined,
        name: d.name as string | undefined,
        visible: d.visible as boolean | undefined,
        lock: d.lock as boolean | undefined,
        data: d.data as Record<string, unknown> | undefined,
      })),
    );
  }

  replaceElements(dtos: Record<string, unknown>[]): void {
    this.canvas.elementManager.replaceElements(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        type: d.type as ElementType,
        attributes: (d.attributes ?? d) as Record<string, string>,
        groupId: d.groupId as string | undefined,
        name: d.name as string | undefined,
        visible: d.visible as boolean | undefined,
        lock: d.lock as boolean | undefined,
        data: d.data as Record<string, unknown> | undefined,
      })),
    );
  }

  updateElements(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    this.canvas.elementManager.updateElements(patches);
  }

  loadGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.groupManager.loadGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  addGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.groupManager.addGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  replaceGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.groupManager.replaceGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  updateGroups(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    this.canvas.groupManager.updateGroups(patches);
  }

  getFillColorMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.canvas.elementManager.getFillColorMap()) {
      result[key] = Array.from(set);
    }
    return result;
  }

  getStrokeColorMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.canvas.elementManager.getStrokeColorMap()) {
      result[key] = Array.from(set);
    }
    return result;
  }

  recalculateColorMaps(): void {
    this.canvas.elementManager.recalculateColorMaps();
  }

  setColorQuantStep(step: number): void {
    this.canvas.elementManager.setColorQuantStep(step);
  }
}
