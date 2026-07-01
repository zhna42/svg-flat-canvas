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
import { PreloaderOverlay } from '@/debug/PreloaderOverlay';
import { GridOverlay } from '@/debug/GridOverlay';
import { ColorMap } from '@/color/ColorMap';
import { GroupManager } from '@/group';
import { CommandBus } from '@/commands';
import { TimeMachine } from '@/time-machine';
import { RulerManager } from '@/ruler';
import type { GuidelineData } from '@/ruler';
import { BooleanHandler } from '@/boolean';
import type { BooleanOp } from '@/boolean';
import { CreationHandler } from '@/creation/CreationHandler';
import { ExternalApi } from '@/api/external-api';
import { PathElement } from '@/shapes/elements/PathElement';
import { getRenderQueue } from '@/utils/render-queue-utils';
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
  preloaderOverlay!: PreloaderOverlay;
  gridOverlay!: GridOverlay;
  colorMap!: ColorMap;
  groupManager!: GroupManager;
  commandBus!: CommandBus;
  timeMachine!: TimeMachine;
  creationHandler!: CreationHandler;
  rulerManager!: RulerManager;
  booleanHandler!: BooleanHandler;
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
    shape.clearHistoryDiff();
    getRenderQueue()?.add(shape);
  }

  public loadJSON(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
      this.indexShape(el);
      getRenderQueue()?.add(el);
    }
    this.timeMachine.clear();
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    const artboard = this.renderer.getArtboard();
    artboard.setSize(widthMM, heightMM);
    const vb = this.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    const viewW = parts[2] || 800;
    const viewH = parts[3] || 600;

    const ctm = this.svg.getScreenCTM();
    let realW = viewW;
    let realH = viewH;
    if (ctm) {
      const rect = this.svg.getBoundingClientRect();
      const inv = ctm.inverse();
      const p = this.svg.createSVGPoint();
      p.x = rect.width;
      p.y = rect.height;
      const vp = p.matrixTransform(inv);
      realW = vp.x;
      realH = vp.y;
    }

    this.camera.fitToViewport(
      widthMM * 3.7795,
      heightMM * 3.7795,
      realW,
      realH,
      40,
    );
    this.events.emit('artboard-resized', { widthMM, heightMM });
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
      getRenderQueue()?.add(el);
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

  private _editingPathUnsub: (() => void) | null = null;

  public set editingPath(path: PathElement | null) {
    if (this._editingPath && this._editingPath !== path) {
      this._editingPath.isNodeEditing = false;
      if (this._editingPathUnsub) {
        this._editingPathUnsub();
        this._editingPathUnsub = null;
      }
    }
    this._editingPath = path;
    this.creationHandler.editingPathElement = path;
    if (path) {
      path.isNodeEditing = true;
      this._editingPathUnsub = path.subscribe('geometry.commands', () => {
        this.selectionOverlay.updatePathNodes(path);
      });
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

  public setTransformMode(mode: TransformMode): void {
    this.transformHandler.setMode(mode);
  }

  public setProportionalResize(enabled: boolean): void {
    this.transformHandler.setProportionalResize(enabled);
  }

  public startTransform(mode: TransformMode): void {
    const selected = this.selectionState.selected;
    if (selected.length === 0) return;
    this.transformHandler.setMode(mode);
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

  public setRulersVisible(v: boolean): void {
    this.rulerManager.setRulersVisible(v);
  }

  public getRulersVisible(): boolean {
    return this.rulerManager.getRulersVisible();
  }

  public addGuideline(orientation: 'v' | 'h', position: number): string {
    return this.rulerManager.addGuideline(orientation, position);
  }

  public removeGuideline(id: string): void {
    this.rulerManager.removeGuideline(id);
  }

  public getGuidelines(): GuidelineData[] {
    return this.rulerManager.getGuidelines();
  }

  public setGuidelinesVisible(orientation: 'v' | 'h', visible: boolean): void {
    this.rulerManager.setGuidelinesVisible(orientation, visible);
  }

  public getGuidelinesVisible(orientation: 'v' | 'h'): boolean {
    return this.rulerManager.getGuidelinesVisible(orientation);
  }

  public enterBooleanMode(op: BooleanOp): void {
    this.booleanHandler.enterMode(op);
  }

  public exitBooleanMode(): void {
    this.booleanHandler.exitMode();
  }

  public getBooleanHandler(): BooleanHandler {
    return this.booleanHandler;
  }

  public resizeElement(id: string, _width: number, _height: number): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    const bbox = el.getTransformedBBox();
    if (bbox.width > 0) {
      el.transform.scale({
        x: 0,
        y: 0,
        originX: bbox.x,
        originY: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
      el.rebuildHitArea();
    }
  }

  public rotateElement(id: string, angle: number): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.rotate(angle, el.getLocalCenter());
    el.rebuildHitArea();
  }

  public transformElement(
    id: string,
    matrix: [number, number, number, number, number, number],
  ): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.matrix = new DOMMatrix(matrix);
    el.rebuildHitArea();
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

  public setSnapToGuidelines(enabled: boolean): void {
    this.selectionHandler.setSnapToGuidelines(enabled);
  }

  public setSnapToGrid(enabled: boolean): void {
    this.selectionHandler.setSnapToGrid(enabled);
  }

  public setSnapAxis(mode: 'both' | 'horizontal' | 'vertical'): void {
    this.selectionHandler.setSnapAxis(mode);
  }

  public getOutlinePath(
    id: string,
  ): import('@/shapes/elements/PathElement').PathElement | null {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return null;
    return el.toOutlinePath();
  }

  public outlineElement(id: string): void {
    const el = this.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    const outline = el.toOutlinePath();
    this.spatialGrid.removeById(el.id, el.getSpatialCellIds());
    this.shapeManager.removeElementAndNode(el.id);
    this.shapeManager.addElement(outline);
    this.indexShape(outline);
    getRenderQueue()?.add(outline);
    this.events.emit('element-outlined', { id, newId: outline.id });
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

  public loadGroups(data: GroupData[]): void {
    this.groupManager.loadGroups(data);
    this.events.emit('groups-loaded', data);
  }

  public addGroups(data: GroupData[]): void {
    this.groupManager.addGroups(data);
    this.events.emit('groups-added', data);
  }

  public replaceGroups(data: GroupData[]): void {
    this.groupManager.replaceGroups(data);
    this.events.emit('groups-replaced', data);
  }

  public updateGroups(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    this.groupManager.updateGroups(patches);
    this.events.emit('groups-updated', patches);
  }

  public getUnsavedGroupDTOs(): Array<Record<string, unknown>> {
    return this.groupManager.getUnsavedDTOs();
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
    const ids = this.spatialGrid.insert(
      shape.id,
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
    );
    shape.setSpatialCellIds(ids);
    shape.onSpatialIndexChanged = (el) => {
      this.reindexElement(el);
    };
    shape.onColorChanged = (el) => {
      const oldFillKey = (el.data._prevFillKey as string) || null;
      const oldStrokeKey = (el.data._prevStrokeKey as string) || null;
      this.updateColorMapEntry(el, oldFillKey, oldStrokeKey);
    };
    this.addToColorMap(shape);
  }

  private updateColorMapEntry(
    el: AbstractGraphicElement,
    oldFillKey: string | null,
    oldStrokeKey: string | null,
  ): void {
    if (oldFillKey) this.colorMap.removeFromFillMap(oldFillKey, el.id);
    if (oldStrokeKey) this.colorMap.removeFromStrokeMap(oldStrokeKey, el.id);

    let newFillKey: string | null = null;
    let newStrokeKey: string | null = null;

    if (el.style.fill && el.style.fill !== 'none') {
      newFillKey = this.colorMap.getFillKey(el.style.fill);
      this.colorMap.addToFillMap(newFillKey, el.id);
    }
    if (el.style.stroke && el.style.stroke !== 'none') {
      newStrokeKey = this.colorMap.getStrokeKey(el.style.stroke);
      this.colorMap.addToStrokeMap(newStrokeKey, el.id);
    }

    el.data._prevFillKey = newFillKey;
    el.data._prevStrokeKey = newStrokeKey;
  }

  private addToColorMap(el: AbstractGraphicElement): void {
    if (el.style.fill && el.style.fill !== 'none') {
      const key = this.colorMap.getFillKey(el.style.fill);
      this.colorMap.addToFillMap(key, el.id);
      el.data._prevFillKey = key;
    }
    if (el.style.stroke && el.style.stroke !== 'none') {
      const key = this.colorMap.getStrokeKey(el.style.stroke);
      this.colorMap.addToStrokeMap(key, el.id);
      el.data._prevStrokeKey = key;
    }
  }

  reindexElement(el: AbstractGraphicElement): void {
    const bbox = el.getTransformedBBox();
    const newIds = this.spatialGrid.updateElement(
      el.id,
      el.getSpatialCellIds(),
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
    );
    el.setSpatialCellIds(newIds);
  }

  reindexSpatialGrid(): void {
    this.spatialGrid.clear();
    for (const el of this.shapeManager.getAll()) {
      const bbox = el.getTransformedBBox();
      const ids = this.spatialGrid.insert(
        el.id,
        bbox.x,
        bbox.y,
        bbox.width,
        bbox.height,
      );
      el.setSpatialCellIds(ids);
      el.onSpatialIndexChanged = (element) => {
        this.reindexElement(element);
      };
      el.onColorChanged = (element) => {
        const oldFillKey = (element.data._prevFillKey as string) || null;
        const oldStrokeKey = (element.data._prevStrokeKey as string) || null;
        this.updateColorMapEntry(element, oldFillKey, oldStrokeKey);
      };
    }
  }

  public loadElements(items: ElementJSON[]): void {
    this.shapeManager.clear();
    this.spatialGrid.clear();
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
      this.indexShape(el);
      getRenderQueue()?.add(el);
    }
    this.timeMachine.clear();
    this.events.emit('elements-loaded', elements);
  }

  public addElements(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
      this.indexShape(el);
      getRenderQueue()?.add(el);
    }
    this.events.emit('elements-added', elements);
  }

  public replaceElements(items: ElementJSON[]): void {
    const elements: AbstractGraphicElement[] = [];
    for (const item of items) {
      const old = this.shapeManager.getAll().find((e) => e.id === item.id);
      if (old) {
        this.spatialGrid.removeById(old.id, old.getSpatialCellIds());
        this.shapeManager.remove(old.id);
      }
      const el = createFromJSONArray([item])[0];
      this.shapeManager.add(el);
      this.indexShape(el);
      getRenderQueue()?.add(el);
      elements.push(el);
    }
    this.events.emit('elements-replaced', elements);
  }

  public updateElements(
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

  public selectElements(ids: string[]): void {
    const elements = this.shapeManager
      .getAll()
      .filter((e) => ids.includes(e.id));
    this.selectionState.replace(elements);
    this.selectionOverlay.setPositions(elements);
  }

  public getSelectedStyles(): Array<Record<string, unknown>> {
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

  public getFillColorMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.colorMap.fillMap;
  }

  public getStrokeColorMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.colorMap.strokeMap;
  }

  public recalculateColorMaps(): void {
    this.colorMap.recalculate(
      this.shapeManager.getAll().map((el) => ({
        id: el.id,
        fill: el.style.fill,
        stroke: el.style.stroke,
      })),
    );
    this.events.emit('color-map-recalculated', {
      fillMap: this.getFillColorMap(),
      strokeMap: this.getStrokeColorMap(),
    });
  }

  public setColorQuantStep(step: number): void {
    this.colorMap.setStep(step);
    this.recalculateColorMaps();
  }

  public showPreloader(): void {
    if (this.preloaderOverlay.visible) return;
    const vb = this.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    this.preloaderOverlay.showCentered(parts[2] || 800, parts[3] || 600);
    this.events.emit('preloader-toggled', { visible: true });
  }

  public hidePreloader(): void {
    if (!this.preloaderOverlay.visible) return;
    this.preloaderOverlay.hide();
    this.events.emit('preloader-toggled', { visible: false });
  }

  public isPreloaderVisible(): boolean {
    return this.preloaderOverlay.visible;
  }

  public showGrid(): void {
    if (this.gridOverlay.visible) return;
    this.gridOverlay.show();
    this.events.emit('grid-toggled', { visible: true });
  }

  public hideGrid(): void {
    if (!this.gridOverlay.visible) return;
    this.gridOverlay.hide();
    this.events.emit('grid-toggled', { visible: false });
  }

  public isGridVisible(): boolean {
    return this.gridOverlay.visible;
  }

  public setGridStep(mm: number): void {
    this.gridOverlay.setStep(mm);
    this.events.emit('grid-step-changed', { stepMM: mm });
  }

  public getGridStep(): number {
    return this.gridOverlay.stepMM;
  }

  public getUnsavedDTOs(): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];
    for (const el of this.shapeManager.getAll()) {
      if (el.isPreview) continue;
      const dto = el.getUnsavedDTO();
      if (dto) result.push(dto);
    }
    return result;
  }

  syncGroupSelectionOverlay(): void {
    const selectedGroups = Array.from(this.groupManager.selectedGroupIds)
      .map((id) => this.groupManager.getGroup(id))
      .filter((g): g is Group => g !== undefined);
    this.groupSelectionOverlay.sync(selectedGroups, (id: string) =>
      this.shapeManager.getAll().find((e) => e.id === id),
    );
  }

  public reorderElement(
    id: string,
    position: 'before' | 'after',
    targetId: string,
  ): void {
    if (position === 'before') {
      this.renderer.moveElementBefore(id, targetId);
    } else {
      this.renderer.moveElementAfter(id, targetId);
    }
  }
}
