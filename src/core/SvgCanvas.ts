import { EventManager } from '@/events/EventManager';
import { Renderer } from '@/renderer/Renderer';
import { ShapeManager } from '@/shapes/ShapeManager';
import { Camera } from '@/camera/Camera';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import { createFromJSONArray } from '@/shapes/elements/factory';
import type { ElementJSON } from '@/shapes/elements/factory';
import type { SvgCanvasOptions } from '@/types';
import { SelectionState } from '@/selection/SelectionState';
import { SpatialGrid } from '@/selection/SpatialGrid';
import { SelectionHandler } from '@/selection/handlers/SelectionHandler';
import type { SelectionMode } from '@/selection/SelectionMode';
import type { SelectionFilter } from '@/selection/selection-filter';
import type { SelectionShortcuts } from '@/selection/selection-defaults';
import type { SelectionGesture } from '@/commands';
import { SelectionOverlay } from '@/selection/SelectionOverlay';
import { GroupSelectionOverlay } from '@/selection/GroupSelectionOverlay';
import { DebugOverlay } from '@/debug/DebugOverlay';
import {
  GroupManager,
  type GroupData,
  type GroupConflictAction,
} from '@/group';
import type { Group } from '@/group';
import { EventBus, Events } from './EventBus';
import { CommandBus } from '@/commands';
import { TimeMachine, type TimeMachineRecord } from '@/time-machine';
import {
  createGroupCreateCommand,
  createGroupDeleteCommand,
  createGroupAddCommand,
  createGroupRemoveCommand,
  createGroupClearCommand,
} from '@/commands/factories/group-command-factory';
import { createSelectHandler } from '@/commands/handlers/select-handler';
import { createDragMoveHandler, createDragEndHandler } from '@/commands/handlers/drag-handler';
import { createGroupHandler } from '@/commands/handlers/group-handler';

export class SvgCanvas {
  private readonly element: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly camera: Camera;
  private readonly renderer: Renderer;
  private readonly shapeManager: ShapeManager;
  private readonly eventManager: EventManager;
  private readonly selectionState: SelectionState;
  private readonly spatialGrid: SpatialGrid;
  private readonly selectionHandler: SelectionHandler;
  private readonly selectionOverlay: SelectionOverlay;
  private readonly debugOverlay: DebugOverlay;
  private readonly groupManager: GroupManager;
  private readonly commandBus: CommandBus;
  private readonly timeMachine: TimeMachine;
  private _debugShowHitArea: boolean;

  public readonly panActive = { value: false };
  public readonly events = new EventBus();

  public constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    this.element = container;
    this.svg = this.createSvgElement(options);
    this.camera = new Camera();
    this.renderer = new Renderer(this.svg, this.camera);
    this.shapeManager = new ShapeManager(this.renderer);
    this.eventManager = new EventManager(this.svg);
    this.selectionState = new SelectionState();
    this.spatialGrid = new SpatialGrid(800, 600, 100);

    this.timeMachine = new TimeMachine(
      () => this.shapeManager.getAll(),
      (dto) => this.applyEntityDTO('element', dto),
      100,
    );
    this.commandBus = new CommandBus(this.timeMachine);
    this.commandBus.register(
      'SELECT',
      createSelectHandler({
        state: this.selectionState,
        getElements: () => this.shapeManager.getAll(),
        grid: this.spatialGrid,
        cameraGroup: this.renderer.getCameraGroup(),
        lookupGroup: (elementId) => {
          const g = this.groupManager.getGroupByElement(elementId);
          return g?.id;
        },
      }),
    );
    const dragCtx = {
      getElements: () => this.shapeManager.getAll(),
      onDragEnd: (_ids: string[]) => {
        this.reindexSpatialGrid();
        this.events.emit(Events.DragEnd, undefined);
      },
    };
    this.commandBus.register('DRAG_MOVE', createDragMoveHandler(dragCtx));
    this.commandBus.register('DRAG_END', createDragEndHandler(dragCtx));

    const panActive = this.panActive;
    const onGroupSelect = (ids: string[]): void => {
      this.selectionState.clear();
      this.groupManager.setSelectedGroupIds(ids);
      this.events.emit(Events.GroupSelect, ids);
    };
    const onDragMove = (): void => {
      this.selectionOverlay.update(this.selectionState.selected);
      this.groupManager.refreshOverlay();
      this.events.emit(Events.DragMove, undefined);
    };

    this.selectionHandler = new SelectionHandler({
      svg: this.svg,
      cameraGroup: this.renderer.getCameraGroup(),
      camera: this.camera,
      state: this.selectionState,
      getElements: () => this.shapeManager.getAll(),
      grid: this.spatialGrid,
      bus: this.commandBus,
      isPanning: () => panActive.value,
      getGroupIdForElement: (elementId) => {
        const g = this.groupManager.getGroupByElement(elementId);
        return g?.id;
      },
      onGroupSelect,
      onDragStart: () => {
        this.events.emit(Events.DragStart, undefined);
      },
      onDragMove,
      onDragEnd: () => {
        this.events.emit(Events.DragEnd, undefined);
      },
    });

    this.element.appendChild(this.svg);

    const overlaysGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    this.renderer.appendOverlay(overlaysGroup);

    this.selectionOverlay = new SelectionOverlay(this.camera);
    overlaysGroup.appendChild(this.selectionOverlay.getElement());

    this.debugOverlay = new DebugOverlay(this.camera);
    overlaysGroup.appendChild(this.debugOverlay.getElement());
    this._debugShowHitArea = options?.debugShowHitArea ?? false;

    const groupOverlay = new GroupSelectionOverlay(
      this.camera,
      this.renderer.getQueue(),
    );
    overlaysGroup.appendChild(groupOverlay.getElement());

    this.groupManager = new GroupManager(groupOverlay, () =>
      this.shapeManager.getAll(),
    );
    this.groupManager.setOnChange(() =>
      this.events.emit(Events.GroupsChange, undefined),
    );

    this.commandBus.register('GROUP_CREATE', createGroupHandler(this.groupManager));
    this.commandBus.register('GROUP_DELETE', createGroupHandler(this.groupManager));
    this.commandBus.register('GROUP_ADD', createGroupHandler(this.groupManager));
    this.commandBus.register('GROUP_REMOVE', createGroupHandler(this.groupManager));
    this.commandBus.register('GROUP_CLEAR', createGroupHandler(this.groupManager));

    const updateOverlay = (): void => {
      this.selectionOverlay.update(this.selectionState.selected);
      if (this._debugShowHitArea) {
        this.debugOverlay.update(this.shapeManager.getAll());
      }
    };
    this.selectionState.setOnChange(updateOverlay);

    const origSetOnChange = this.selectionState.setOnChange.bind(
      this.selectionState,
    );
    this.selectionState.setOnChange = (fn) => {
      origSetOnChange((selected) => {
        fn?.(selected);
        updateOverlay();
        this.events.emit(Events.SelectionChange, selected);
      });
    };
  }

  public getSVG(): SVGSVGElement {
    return this.svg;
  }

  public getCamera(): Camera {
    return this.camera;
  }

  public addShape(shape: SvgElement): void {
    this.shapeManager.add(shape);
    this.indexShape(shape);
  }

  public loadJSON(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
      this.indexShape(el);
    }
    this.timeMachine.captureRoot();
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    const artboard = this.renderer.getArtboard();
    artboard.setSize(widthMM, heightMM);

    const vb = this.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    const vw = parts[2] || 800;
    const vh = parts[3] || 600;
    const pw = widthMM * 3.7795;
    const ph = heightMM * 3.7795;
    this.camera.fitToViewport(pw, ph, vw, vh, 40);
  }

  // ---- Selection API ----

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

  public set onSelectionChange(fn: ((selected: SvgElement[]) => void) | null) {
    this.selectionState.setOnChange(fn);
  }

  public getSelected(): readonly SvgElement[] {
    return this.selectionState.selected;
  }

  // ---- EventBus shorthands ----

  public on<E extends Events>(
    event: E,
    fn: (data: import('./EventBus').EventMap[E]) => void,
  ): () => void {
    return this.events.on(event, fn as any);
  }

  public off<E extends Events>(
    event: E,
    fn: (data: import('./EventBus').EventMap[E]) => void,
  ): void {
    this.events.off(event, fn as any);
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

  // ---- Undo / Redo ----

  public undo(): void {
    this.selectionState.clear();
    this.groupManager.clearSelectedGroups();
    this.timeMachine.undo();
    this.reindexSpatialGrid();
    for (const el of this.shapeManager.getAll()) {
      el.setDirty();
      el.markClean();
    }
  }

  public redo(): void {
    this.selectionState.clear();
    this.groupManager.clearSelectedGroups();
    this.timeMachine.redo();
    this.reindexSpatialGrid();
    for (const el of this.shapeManager.getAll()) {
      el.setDirty();
      el.markClean();
    }
  }

  public get canUndo(): boolean {
    return this.timeMachine.canUndo;
  }

  public get canRedo(): boolean {
    return this.timeMachine.canRedo;
  }

  public get debugShowHitArea(): boolean {
    return this._debugShowHitArea;
  }

  public set debugShowHitArea(v: boolean) {
    this._debugShowHitArea = v;
    if (v) {
      this.debugOverlay.update(this.shapeManager.getAll());
    } else {
      this.debugOverlay.update([]);
    }
  }

  // ---- Group API (through CommandBus) ----

  public get groups(): Group[] {
    return this.groupManager.getGroups();
  }

  public setGroups(data: GroupData[]): void {
    this.groupManager.setGroups(data);
    this.timeMachine.captureRoot();
  }

  public createGroup(name?: string): string {
    const cmd = createGroupCreateCommand(name);
    this.commandBus.execute(cmd);
    const created = this.groupManager.getGroups();
    return created[created.length - 1]?.id ?? '';
  }

  public deleteGroup(id: string): void {
    const cmd = createGroupDeleteCommand(id);
    this.commandBus.execute(cmd);
  }

  public addToGroup(groupId: string, elementIds: string[]): void;
  public addToGroup(groupId: string, elementId: string): void;
  public addToGroup(groupId: string, elementOrIds: string | string[]): void {
    const ids = Array.isArray(elementOrIds) ? elementOrIds : [elementOrIds];
    const cmd = createGroupAddCommand(groupId, ids);
    this.commandBus.execute(cmd);
  }

  public removeFromGroup(groupId: string, elementIds: string[]): void;
  public removeFromGroup(groupId: string, elementId: string): void;
  public removeFromGroup(groupId: string, elementOrIds: string | string[]): void {
    const ids = Array.isArray(elementOrIds) ? elementOrIds : [elementOrIds];
    const cmd = createGroupRemoveCommand(groupId, ids);
    this.commandBus.execute(cmd);
  }

  public clearGroup(id: string): void {
    const cmd = createGroupClearCommand(id);
    this.commandBus.execute(cmd);
  }

  public getElementIdsInGroup(id: string): string[] {
    return this.groupManager.getElementIdsInGroup(id);
  }

  public selectGroupElements(id: string): void {
    const ids = this.groupManager.getElementIdsInGroup(id);
    const all = this.shapeManager.getAll();
    const elements = all.filter((e) => ids.includes(e.id));
    this.selectionState.replace(elements);
  }

  public selectGroup(id: string): void {
    this.selectionState.clear();
    this.groupManager.setSelectedGroupIds([id]);
  }

  public selectMultipleGroups(ids: string[]): void {
    this.groupManager.setSelectedGroupIds(ids);
  }

  public selectGroupWithElements(id: string): void {
    this.groupManager.setSelectedGroupIds([id]);
    const ids = this.groupManager.getElementIdsInGroup(id);
    const all = this.shapeManager.getAll();
    const elements = all.filter((e) => ids.includes(e.id));
    this.selectionState.replace(elements);
  }

  public getSelectedGroupIds(): string[] {
    return Array.from(this.groupManager.selectedGroupIds);
  }

  public highlightGroupElements(id: string): void {
    const ids = this.groupManager.getElementIdsInGroup(id);
    const all = this.shapeManager.getAll();
    const elements = all.filter((e) => ids.includes(e.id));
    this.selectionState.replace(elements);
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

  // ---- TimeMachine serialization ----

  public saveTimeMachine(): TimeMachineRecord[] {
    return this.timeMachine.toJSON();
  }

  public loadTimeMachine(records: TimeMachineRecord[]): void {
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

  private createSvgElement(options?: SvgCanvasOptions): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const w = options?.width ?? 800;
    const h = options?.height ?? 600;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.display = 'block';
    return svg;
  }

  private indexShape(shape: SvgElement): void {
    const bbox = shape.getBBox();
    this.spatialGrid.insert(shape.id, bbox.x, bbox.y, bbox.width, bbox.height);
  }

  private reindexSpatialGrid(): void {
    this.spatialGrid.clear();
    const all = this.shapeManager.getAll();
    for (const el of all) {
      const bbox = el.getBBox();
      this.spatialGrid.insert(el.id, bbox.x, bbox.y, bbox.width, bbox.height);
    }
  }

  private applyEntityDTO(_kind: string, dto: Record<string, unknown>): void {
      const id = dto.id as string;
      let el = this.shapeManager.getAll().find((e) => e.id === id);
      if (!el) {
        const type = dto.type as string;
        const attrs = (dto.attributes ?? {}) as Record<string, string>;
        const elementJSON: ElementJSON = {
          id,
          type: type as any,
          attributes: attrs,
          groupId: dto.groupId as string | undefined,
          name: dto.name as string | undefined,
          visible: dto.visible as boolean | undefined,
          lock: dto.lock as boolean | undefined,
          data: dto.data as Record<string, unknown> | undefined,
          textContent: dto.textContent as string | undefined,
        };
        el = createFromJSONArray([elementJSON])[0];
        this.shapeManager.add(el);
        this.indexShape(el);
      } else {
        el.applyDTO(dto);
      }
  }
}
