import { Camera } from '@/camera/Camera';
import { Renderer } from '@/renderer/Renderer';
import { ShapeManager } from '@/shapes/ShapeManager';
import { EventManager } from '@/events/EventManager';
import { SelectionState } from '@/selection/SelectionState';
import { SpatialGrid } from '@/spatial/SpatialGrid';
import { SelectionHandler } from '@/selection/handlers/SelectionHandler';
import { SelectionOverlay } from '@/selection/overlay/SelectionOverlay';
import { GroupSelectionOverlay } from '@/selection/overlay/GroupSelectionOverlay';
import { TransformHandler } from '@/selection/transform/TransformHandler';
import { DebugOverlay } from '@/debug/DebugOverlay';
import { GroupManager } from '@/group';
import { CommandBus } from '@/commands';
import { TimeMachine } from '@/time-machine';
import { CreationHandler } from '@/creation/CreationHandler';
import { ExternalApi } from '@/api/external-api';
import { PathElement } from '@/shapes/elements/PathElement';
import { EventBus } from './EventBus';
import { CanvasFactory } from './CanvasFactory';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { ElementJSON } from '@/shapes/elements/factory';
import { createFromJSONArray } from '@/shapes/elements/factory';
import { createDeleteCommand } from '@/commands/factories/delete-command-factory';
import {
  createGroupCreateCommand,
  createGroupDeleteCommand,
  createGroupAddCommand,
  createGroupRemoveCommand,
  createGroupClearCommand,
} from '@/commands/factories/group-command-factory';
import type { Group, GroupData, GroupConflictAction } from '@/group';
import type { TimeSnapshot } from '@/time-machine';
import type { SelectionMode, CreationElementType } from '@/commands/types';
import type { SelectionFilter } from '@/selection/selection-filter';
import type { SelectionShortcuts } from '@/selection/selection-defaults';
import type { SelectionGesture } from '@/commands';
import type { TransformMode } from '@/selection/transform/TransformHandler';
import type { SvgCanvasOptions } from '@/types';
import type { BusEvent } from './EventBus';

export class SvgCanvas {
  element!: HTMLElement;
  svg!: SVGSVGElement;
  camera!: Camera;
  renderer!: Renderer;
  shapeManager!: ShapeManager;
  eventManager!: EventManager;
  selectionState!: SelectionState;
  spatialGrid!: SpatialGrid;
  selectionHandler!: SelectionHandler;
  selectionOverlay!: SelectionOverlay;
  groupSelectionOverlay!: GroupSelectionOverlay;
  transformHandler!: TransformHandler;
  debugOverlay!: DebugOverlay;
  groupManager!: GroupManager;
  commandBus!: CommandBus;
  timeMachine!: TimeMachine;
  creationHandler!: CreationHandler;
  _debugShowHitArea!: boolean;
  _externalApi!: ExternalApi;
  _editingPath: PathElement | null = null;
  panActive!: { value: boolean };
  events!: EventBus;

  public constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    return CanvasFactory.create(container, options) as unknown as this;
  }

  public getSVG(): SVGSVGElement {
    return this.svg;
  }
  public getCamera(): Camera {
    return this.camera;
  }

  public addShape(shape: AbstractGraphicElement): void {
    this.shapeManager.add(shape);
    this.indexShape(shape);
    shape.getDiffKeysForTimeMashin().clear();
    shape.setDirtyAll();
  }

  public loadJSON(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
      this.indexShape(el);
      el.setDirtyAll();
    }
    this.timeMachine.clear();
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    const artboard = this.renderer.getArtboard();
    artboard.setSize(widthMM, heightMM);
    const vb = this.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    this.camera.fitToViewport(
      widthMM * 3.7795,
      heightMM * 3.7795,
      parts[2] || 800,
      parts[3] || 600,
      40,
    );
  }

  public setSelectionMode(mode: SelectionMode): void {
    this.selectionState.setMode(mode);
  }
  public getSelectionMode(): SelectionMode {
    return this.selectionState.mode;
  }
  public set onSelectionModeChange(fn: ((mode: SelectionMode) => void) | null) {
    this.selectionState.setOnModeChange(fn);
  }
  public set selectionFilter(fn: SelectionFilter | null) {
    this.selectionState.setFilter(fn);
  }
  public set onSelectionChange(
    fn: ((selected: AbstractGraphicElement[]) => void) | null,
  ) {
    this.selectionState.setOnChange(fn);
  }
  public getSelected(): readonly AbstractGraphicElement[] {
    return this.selectionState.selected;
  }
  public setSelectedElements(elements: AbstractGraphicElement[]): void {
    this.selectionState.replace(elements);
  }

  public setNonScalingStroke(id: string, v: boolean): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (el) {
      const node = this.renderer.getNode(id);
      if (node) {
        if (v) node.setAttribute('vector-effect', 'non-scaling-stroke');
        else node.removeAttribute('vector-effect');
      }
      el.setDirtyAll();
    }
  }

  public on(event: string, fn: (event: BusEvent) => void): () => void {
    return this.events.on(event, fn);
  }
  public off(event: string, fn: (event: BusEvent) => void): void {
    this.events.off(event, fn);
  }

  public setSelectionShortcuts(s: Partial<SelectionShortcuts>): void {
    this.selectionHandler.setShortcuts(s);
  }
  public setSelectionGesture(g: SelectionGesture): void {
    this.selectionHandler.setGesture(g);
  }
  public getSelectionGesture(): SelectionGesture {
    return this.selectionHandler.getGesture();
  }
  public getCommandBus(): CommandBus {
    return this.commandBus;
  }
  public getTimeMachine(): TimeMachine {
    return this.timeMachine;
  }
  public getCreationHandler(): CreationHandler {
    return this.creationHandler;
  }

  public getArtboard(): import('@/renderer/Artboard').Artboard {
    return this.renderer.getArtboard();
  }

  public get editingPath(): PathElement | null {
    return this._editingPath;
  }

  public set editingPath(path: PathElement | null) {
    if (this._editingPath && this._editingPath !== path) {
      this._editingPath.setIsNodeEditing(false);
      this._editingPath.onDirty = null;
    }
    this._editingPath = path;
    this.creationHandler.editingPathElement = path;
    if (path) {
      path.setIsNodeEditing(true);
      path.onDirty = () => {
        this.selectionOverlay.updatePathNodes(path);
      };
      this.selectionOverlay.setElements([path]);
    } else {
      this.selectionOverlay.setElements(this.selectionState.selected);
    }
  }

  public getExternalApi(): ExternalApi {
    return this._externalApi;
  }

  public setActiveCreationTool(type: CreationElementType | null): void {
    this.creationHandler.setActiveType(type);
    if (type !== null) {
      this.panActive.value = false;
    }
  }

  public undo(): void {
    if (this._editingPath) return;
    this.selectionState.clear();
    this.groupManager.clearSelectedGroups();
    this.groupSelectionOverlay.clear();
    this.timeMachine.undo();
    this.reindexSpatialGrid();
  }

  public redo(): void {
    if (this._editingPath) return;
    this.selectionState.clear();
    this.groupManager.clearSelectedGroups();
    this.groupSelectionOverlay.clear();
    this.timeMachine.redo();
    this.reindexSpatialGrid();
  }

  public get canUndo(): boolean {
    return this.timeMachine.canUndo;
  }
  public get canRedo(): boolean {
    return this.timeMachine.canRedo;
  }

  public startTransform(_mode: TransformMode): void {
    const selected = this.selectionState.selected;
    if (selected.length === 0) return;
    const bbox = selected[0].getTransformedBBox();
    this.transformHandler.tryStart(
      'se',
      new DOMRect(bbox.x, bbox.y, bbox.width, bbox.height),
      selected[0],
      { x: 0, y: 0 },
      selected,
    );
  }

  public endTransform(): void {
    if (this.transformHandler.isActive) this.transformHandler.end();
  }

  public resizeElement(id: string, _width: number, _height: number): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    const bbox = el.getTransformedBBox();
    if (bbox.width > 0) {
      el.applyTransformation('scale', {
        x: 0,
        y: 0,
        originX: bbox.x,
        originY: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
      el.buildHitArea();
    }
  }

  public rotateElement(id: string, angle: number): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.rotate(angle);
    el.buildHitArea();
  }

  public transformElement(
    id: string,
    matrix: [number, number, number, number, number, number],
  ): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.matrix = new DOMMatrix(matrix);
    el.markRenderKey('matrix');
    el.buildHitArea();
    el.setDirtyTransform();
  }

  public setSnapToCorners(enabled: boolean): void {
    this.selectionHandler.setSnapToCorners(enabled);
  }

  public setSnapToPlanes(enabled: boolean): void {
    this.selectionHandler.setSnapToPlanes(enabled);
  }

  public setSnapToArtboard(enabled: boolean): void {
    this.selectionHandler.setSnapToArtboard(enabled);
  }

  public setAvoidCollisions(enabled: boolean): void {
    this.selectionHandler.setAvoidCollisions(enabled);
  }

  getArtboardRect(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    const r = this.renderer.getArtboard().rect;
    return {
      x: r.geometry.x,
      y: r.geometry.y,
      width: r.geometry.width,
      height: r.geometry.height,
    };
  }

  public deleteElements(ids: string[]): void {
    for (const id of ids) {
      this.selectionState.remove(
        Array.from(this.selectionState.selected).filter((e) => e.id === id),
      );
    }
    const cmd = createDeleteCommand(ids);
    this.commandBus.execute(cmd);
  }

  public deleteElement(id: string): void {
    this.deleteElements([id]);
  }

  public get debugShowHitArea(): boolean {
    return this._debugShowHitArea;
  }
  public set debugShowHitArea(v: boolean) {
    this._debugShowHitArea = v;
    this.debugOverlay.update(v ? this.shapeManager.getAll() : []);
  }

  public get groups(): Group[] {
    return this.groupManager.getGroups();
  }

  public setGroups(data: GroupData[]): void {
    this.groupManager.setGroups(data);
    this.timeMachine.clear();
  }

  public createGroup(name?: string): string {
    const cmd = createGroupCreateCommand(name);
    this.commandBus.execute(cmd);
    const created = this.groupManager.getGroups();
    return created[created.length - 1]?.id ?? '';
  }

  public deleteGroup(id: string): void {
    this.commandBus.execute(createGroupDeleteCommand(id));
  }
  public addToGroup(groupId: string, elementId: string): void;
  public addToGroup(groupId: string, elementOrIds: string | string[]): void {
    const ids = Array.isArray(elementOrIds) ? elementOrIds : [elementOrIds];
    this.commandBus.execute(createGroupAddCommand(groupId, ids));
  }
  public removeFromGroup(groupId: string, elementId: string): void;
  public removeFromGroup(
    groupId: string,
    elementOrIds: string | string[],
  ): void {
    const ids = Array.isArray(elementOrIds) ? elementOrIds : [elementOrIds];
    this.commandBus.execute(createGroupRemoveCommand(groupId, ids));
  }
  public clearGroup(id: string): void {
    this.commandBus.execute(createGroupClearCommand(id));
  }
  public getElementIdsInGroup(id: string): string[] {
    return this.groupManager.getElementIdsInGroup(id);
  }

  public selectGroupElements(id: string): void {
    const ids = this.groupManager.getElementIdsInGroup(id);
    this.selectionState.replace(
      this.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  public selectGroup(id: string): void {
    this.selectionState.clear();
    this.groupManager.setSelectedGroupIds([id]);
    this.syncGroupSelectionOverlay();
  }
  public selectMultipleGroups(ids: string[]): void {
    this.groupManager.setSelectedGroupIds(ids);
    this.syncGroupSelectionOverlay();
  }

  public selectGroupWithElements(id: string): void {
    this.groupManager.setSelectedGroupIds([id]);
    this.syncGroupSelectionOverlay();
    const ids = this.groupManager.getElementIdsInGroup(id);
    this.selectionState.replace(
      this.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  public getSelectedGroupIds(): string[] {
    return Array.from(this.groupManager.selectedGroupIds);
  }

  public highlightGroupElements(id: string): void {
    this.selectionState.replace(
      this.shapeManager
        .getAll()
        .filter((e) =>
          this.groupManager.getElementIdsInGroup(id).includes(e.id),
        ),
    );
  }

  public set onGroupsChange(fn: (() => void) | null) {
    this.groupManager.setOnChange(fn);
  }
  public set onGroupConflict(
    fn:
      | ((
          elementId: string,
          fromGroup: string,
          toGroup: string,
        ) => GroupConflictAction | null)
      | null,
  ) {
    this.groupManager.onConflict = fn;
  }
  public get groupConflictSuppressed(): boolean {
    return this.groupManager.conflictSuppressed;
  }
  public set groupConflictSuppressed(v: boolean) {
    this.groupManager.conflictSuppressed = v;
  }

  public saveTimeMachine(): TimeSnapshot[] {
    return this.timeMachine.toJSON();
  }

  public loadTimeMachine(records: TimeSnapshot[]): void {
    this.shapeManager.clear();
    this.groupManager.setGroups([]);
    this.spatialGrid.clear();
    this.timeMachine.fromJSON(records);
  }

  public destroy(): void {
    this.renderer.destroy();
    this.eventManager.destroy();
    this.shapeManager.clear();
    this.groupManager.destroy();
    this.svg.remove();
  }

  indexShape(shape: AbstractGraphicElement): void {
    const bbox = shape.getTransformedBBox();
    this.spatialGrid.insert(shape.id, bbox.x, bbox.y, bbox.width, bbox.height);
  }

  reindexSpatialGrid(): void {
    this.spatialGrid.clear();
    for (const el of this.shapeManager.getAll()) {
      const bbox = el.getTransformedBBox();
      this.spatialGrid.insert(el.id, bbox.x, bbox.y, bbox.width, bbox.height);
    }
  }

  syncGroupSelectionOverlay(): void {
    const selectedGroups = Array.from(this.groupManager.selectedGroupIds)
      .map((id) => this.groupManager.getGroup(id))
      .filter((g): g is Group => g !== undefined);
    this.groupSelectionOverlay.sync(selectedGroups, (id: string) =>
      this.shapeManager.getAll().find((e) => e.id === id),
    );
  }
}
