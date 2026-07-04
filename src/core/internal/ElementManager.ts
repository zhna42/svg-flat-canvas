import type { ShapeManager } from '@/shapes/ShapeManager';
import type { SelectionState } from '@/canvas/overlays/selection/SelectionState';
import type { SelectionManager } from '@/canvas/overlays/selection/SelectionManager';
import type { TimeMachine } from '@/time-machine';
import type { EventBus } from '../EventBus';
import type { CommandBus } from '@/commands';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { ElementJSON } from '@/types';
import { createFromJSONArray } from '@/shapes/elements/factory';
import { createDeleteCommand } from '@/commands/factories/delete-command-factory';
import { SpatialIndexer } from './SpatialIndexer';
import { ColorIndexer } from './ColorIndexer';

export class ElementManager {
  private readonly spatialIndexer: SpatialIndexer;
  private readonly colorIndexer: ColorIndexer;

  constructor(
    private readonly shapeManager: ShapeManager,
    private readonly selectionState: SelectionState,
    private readonly selectionManager: SelectionManager,
    spatialIndexer: SpatialIndexer,
    private readonly timeMachine: TimeMachine,
    private readonly events: EventBus,
    colorIndexer: ColorIndexer,
    private readonly commandBus: CommandBus,
  ) {
    this.spatialIndexer = spatialIndexer;
    this.colorIndexer = colorIndexer;
  }

  addShape(shape: AbstractGraphicElement): void {
    this.shapeManager.add(shape);
    this.spatialIndexer.insert(shape);
    this.colorIndexer.add(shape);
    shape.onSpatialIndexChanged = (el) => this.spatialIndexer.update(el);
    shape.onColorChanged = (el) => this.colorIndexer.update(el);
  }

  loadElements(items: ElementJSON[]): void {
    this.shapeManager.clear();
    const elements = createFromJSONArray(items);
    for (const el of elements) this.shapeManager.add(el);
    this.spatialIndexer.reindexAll(this.shapeManager.getAll());
    for (const el of elements) {
      el.onSpatialIndexChanged = (element) =>
        this.spatialIndexer.update(element);
      el.onColorChanged = (element) => this.colorIndexer.update(element);
    }
    this.colorIndexer.recalculate(elements);
    this.timeMachine.clear();
    this.events.emit('elements-loaded', elements);
  }

  addElements(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
      this.spatialIndexer.insert(el);
      this.colorIndexer.add(el);
      el.onSpatialIndexChanged = (element) =>
        this.spatialIndexer.update(element);
      el.onColorChanged = (element) => this.colorIndexer.update(element);
    }
    this.events.emit('elements-added', elements);
  }

  replaceElements(items: ElementJSON[]): void {
    const elements: AbstractGraphicElement[] = [];
    for (const item of items) {
      const old = this.shapeManager.getAll().find((e) => e.id === item.id);
      if (old) {
        this.spatialIndexer.remove(old);
        this.shapeManager.remove(old.id);
      }
      const el = createFromJSONArray([item])[0];
      this.shapeManager.add(el);
      this.spatialIndexer.insert(el);
      this.colorIndexer.add(el);
      el.onSpatialIndexChanged = (element) =>
        this.spatialIndexer.update(element);
      el.onColorChanged = (element) => this.colorIndexer.update(element);
      elements.push(el);
    }
    this.events.emit('elements-replaced', elements);
  }

  updateElements(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    const all = this.shapeManager.getAll();
    const affected: AbstractGraphicElement[] = [];
    for (const { id, fields } of patches) {
      const el = all.find((e) => e.id === id);
      if (el) {
        el.applyDTO(fields);
        affected.push(el);
      }
    }
    if (affected.length > 0) {
      this.timeMachine.push(
        'UPDATE',
        affected.map((e) => e.id),
        'element',
        [],
        affected,
      );
    }
    this.events.emit('elements-updated', patches);
  }

  deleteElements(ids: string[]): void {
    for (const id of ids) {
      this.selectionState.remove(
        Array.from(this.selectionState.selected).filter((e) => e.id === id),
      );
    }
    this.commandBus.execute(createDeleteCommand(ids));
  }

  selectElements(ids: string[]): void {
    const elements = this.shapeManager
      .getAll()
      .filter((e) => ids.includes(e.id));
    this.selectionState.replace(elements);
    this.selectionManager.setElementSelection(
      ids,
      (id) => this.shapeManager.getById(id),
    );
  }

  getSelectedStyles(): Array<Record<string, unknown>> {
    return this.selectionState.selected.map((el) => ({
      id: el.id,
      type: el.type,
      fill: el.style.fill,
      stroke: el.style.stroke,
      strokeWidth: el.style.strokeWidth,
      opacity: el.style.opacity,
      visible: el.visible,
    }));
  }

  getUnsavedDTOs(): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];
    for (const el of this.shapeManager.getAll()) {
      if (el.isPreview) continue;
      const dto = el.getUnsavedDTO();
      if (dto) result.push(dto);
    }
    return result;
  }

  indexShape(shape: AbstractGraphicElement): void {
    this.spatialIndexer.insert(shape);
    this.colorIndexer.add(shape);
    shape.onSpatialIndexChanged = (el) => this.spatialIndexer.update(el);
    shape.onColorChanged = (el) => this.colorIndexer.update(el);
  }

  reindexElement(el: AbstractGraphicElement): void {
    this.spatialIndexer.update(el);
  }

  reindexAll(): void {
    this.spatialIndexer.reindexAll(this.shapeManager.getAll());
  }

  recalculateColorMaps(): void {
    this.colorIndexer.recalculate(this.shapeManager.getAll());
    this.events.emit('color-map-recalculated', {});
  }
}
