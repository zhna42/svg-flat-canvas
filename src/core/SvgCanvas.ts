import { EventManager } from '@/events/EventManager';
import { Renderer } from '@/renderer/Renderer';
import { ShapeManager } from '@/shapes/ShapeManager';
import { Camera } from '@/camera/Camera';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { createFromJSONArray } from '@/shapes/elements/factory';
import type { ElementJSON } from '@/shapes/elements/factory';
import type { SvgCanvasOptions } from '@/types';
import { SelectionState } from '@/selection/SelectionState';
import { SpatialGrid } from '@/selection/SpatialGrid';
import { SelectionHandler } from '@/selection/handlers/SelectionHandler';
import type { SelectionMode, CreationElementType } from '@/commands/types';
import type { SelectionFilter } from '@/selection/selection-filter';
import type { SelectionShortcuts } from '@/selection/selection-defaults';
import type { SelectionGesture } from '@/commands';
import { SelectionOverlay } from '@/selection/SelectionOverlay';
import { GroupSelectionOverlay } from '@/selection/GroupSelectionOverlay';
import { TransformHandler } from '@/selection/TransformHandler';
import type { TransformMode } from '@/selection/TransformHandler';
import { DebugOverlay } from '@/debug/DebugOverlay';
import { CreationHandler } from '@/creation/CreationHandler';
import {
  GroupManager,
  type GroupData,
  type GroupConflictAction,
} from '@/group';
import type { Group } from '@/group';
import { EventBus } from './EventBus';
import { CommandBus } from '@/commands';
import { TimeMachine } from '@/time-machine';
import type { TimeSnapshot } from '@/time-machine';
import {
  createGroupCreateCommand,
  createGroupDeleteCommand,
  createGroupAddCommand,
  createGroupRemoveCommand,
  createGroupClearCommand,
} from '@/commands/factories/group-command-factory';
import { createSelectHandler } from '@/commands/handlers/select-handler';
import {
  createDragMoveHandler,
  createDragEndHandler,
} from '@/commands/handlers/drag-handler';
import { createGroupHandler } from '@/commands/handlers/group-handler';
import { createDeleteHandler } from '@/commands/handlers/delete-handler';
import { createCreateHandler } from '@/commands/handlers/create-handler';
import { createCreateFileHandler } from '@/commands/handlers/create-file-handler';
import { createDeleteCommand } from '@/commands/factories/delete-command-factory';
import { ExternalApi } from '@/api/external-api';
import { PathElement } from '@/shapes/elements/PathElement';

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
  private readonly groupSelectionOverlay: GroupSelectionOverlay;
  private readonly transformHandler: TransformHandler;
  private readonly debugOverlay: DebugOverlay;
  private readonly groupManager: GroupManager;
  private readonly commandBus: CommandBus;
  private readonly timeMachine: TimeMachine;
  private readonly creationHandler: CreationHandler;
  private _debugShowHitArea: boolean;
  private readonly _externalApi: ExternalApi;
  private _editingPath: PathElement | null = null;
  private _dragOverlayDx = 0;
  private _dragOverlayDy = 0;

  public readonly panActive = { value: false };
  public readonly events = new EventBus();

  public constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    this.element = container;
    this.element.style.userSelect = 'none';
    this.element.style.webkitUserSelect = 'none';
    this.svg = this.createAbstractGraphicElement(options);
    this.svg.setAttribute('tabindex', '0');
    this.camera = new Camera();
    this.renderer = new Renderer(this.svg, this.camera);
    this.camera.cameraGroup = this.renderer.getCameraGroup();
    this.shapeManager = new ShapeManager(this.renderer);
    this.eventManager = new EventManager(this.svg);
    this.selectionState = new SelectionState();
    this.spatialGrid = new SpatialGrid(800, 600, 100);

    this.timeMachine = new TimeMachine(this.shapeManager, 100);
    this.commandBus = new CommandBus(this.timeMachine, this.events);
    this.commandBus.setGetElement((id) => this.shapeManager.getById(id));
    this.commandBus.setGetSelected(() => Array.from(this.selectionState.selected).map((e) => e.id));

    this.selectionOverlay = new SelectionOverlay(this.camera);
    this.selectionState.setOnChange((selected) => {
      this.selectionOverlay.setElements(selected);
    });

    this.transformHandler = new TransformHandler(this.camera, this.commandBus);
    this.transformHandler.onTransformEnd = () => {
      updateOverlay();
    };

    // Camera onChange — перерисовка оверлеев при pan/zoom
    this.camera.onChange = () => {
      const selected = this.selectionState.selected;
      if (selected.length > 0) {
        this.selectionOverlay.setPositions(selected);
      }
      if (this._editingPath) {
        this.selectionOverlay.updatePathNodes(this._editingPath);
      }
      if (this.groupManager.selectedGroupIds.size > 0) {
        this.syncGroupSelectionOverlay();
      }
    };

    // Overlay root — вне cameraGroup (в корне SVG, поверх камеры)
    const overlayRoot = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    this.svg.appendChild(overlayRoot);

    overlayRoot.appendChild(this.selectionOverlay.getElement());

    this.groupSelectionOverlay = new GroupSelectionOverlay(this.camera);
    overlayRoot.appendChild(this.groupSelectionOverlay.getElement());

    this.debugOverlay = new DebugOverlay(this.camera);
    overlayRoot.appendChild(this.debugOverlay.getElement());
    this._debugShowHitArea = options?.debugShowHitArea ?? false;

    // Command registrations
    this.commandBus.register(
      'SELECT',
      createSelectHandler({
        state: this.selectionState,
        getElements: () => this.shapeManager.getAll(),
        grid: this.spatialGrid,
        lookupGroup: (elementId) =>
          this.groupManager.getGroupByElement(elementId)?.id,
      }),
    );

    const updateOverlay = (): void => {
      const selected = this.selectionState.selected;
      if (selected.length > 0) {
        this.selectionOverlay.setPositions(selected);
      }
      if (this.groupManager.selectedGroupIds.size > 0) {
        this.syncGroupSelectionOverlay();
      }
    };

    const dragCtx = {
      getElements: () => this.shapeManager.getAll(),
      onDragEnd: (_ids: string[]) => {
        this.reindexSpatialGrid();
        updateOverlay();
      },
    };
    this.commandBus.register('DRAG_MOVE', createDragMoveHandler(dragCtx));
    this.commandBus.register('DRAG_END', createDragEndHandler(dragCtx));

    const panActive = this.panActive;
    const onGroupSelect = (ids: string[]): void => {
      this.selectionState.clear();
      this.groupManager.setSelectedGroupIds(ids);
      this.syncGroupSelectionOverlay();
    };

    this.selectionHandler = new SelectionHandler({
      svg: this.svg,
      camera: this.camera,
      overlayRoot,
      selectionOverlay: this.selectionOverlay,
      transformHandler: this.transformHandler,
      state: this.selectionState,
      getElements: () => this.shapeManager.getAll(),
      grid: this.spatialGrid,
      bus: this.commandBus,
      isPanning: () => panActive.value,
      getGroupIdForElement: (elementId) =>
        this.groupManager.getGroupByElement(elementId)?.id,
      onGroupSelect,
      getArtboardRect: () => this.getArtboardRect(),
      onDragStart: () => {
        this._dragOverlayDx = 0;
        this._dragOverlayDy = 0;
      },
      onDragMove: (dx: number, dy: number) => {
        const frameDx = dx - this._dragOverlayDx;
        const frameDy = dy - this._dragOverlayDy;
        this._dragOverlayDx = dx;
        this._dragOverlayDy = dy;
        for (const overlayEl of this.selectionOverlay.getOverlayElements()) {
          overlayEl.translateBy(frameDx, frameDy);
        }
      },
      onDragEnd: () => {
        this._dragOverlayDx = 0;
        this._dragOverlayDy = 0;
      },
      onSetEditingPath: (el) => {
        if (el) {
          this.editingPath = el as PathElement;
        } else {
          this.editingPath = null;
        }
      },
      getEditingPath: () => this._editingPath,
    });

    this.element.appendChild(this.svg);

    this.groupManager = new GroupManager(null as any, () =>
      this.shapeManager.getAll(),
    );
    this.groupManager.setOnChange(() => {
      this.syncGroupSelectionOverlay();
    });

    this.commandBus.register(
      'GROUP_CREATE',
      createGroupHandler(this.groupManager),
    );
    this.commandBus.register(
      'GROUP_DELETE',
      createGroupHandler(this.groupManager),
    );
    this.commandBus.register(
      'GROUP_ADD',
      createGroupHandler(this.groupManager),
    );
    this.commandBus.register(
      'GROUP_REMOVE',
      createGroupHandler(this.groupManager),
    );
    this.commandBus.register(
      'GROUP_CLEAR',
      createGroupHandler(this.groupManager),
    );
    this.commandBus.register('DELETE', createDeleteHandler(this.shapeManager));
    this.commandBus.register('CREATE', createCreateHandler(this.shapeManager));
    this.commandBus.register(
      'CREATE_FILE',
      createCreateFileHandler(this.shapeManager, this.groupManager, (el) =>
        this.indexShape(el),
      ),
    );
    this.commandBus.register('GEOMETRY_MUTATE', (command) => {
      if (command.type !== 'GEOMETRY_MUTATE') return;
      const el = this.shapeManager
        .getAll()
        .find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.geometry.commands = command.options.newCommands;
        el.markRenderKey('d');
        el.buildHitArea();
        el.setDirtyAll();
      }
    });

    this.commandBus.register('PATH_ADD_NODE', (command) => {
      if (command.type !== 'PATH_ADD_NODE') return;
      const el = this.shapeManager
        .getAll()
        .find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.addNodeAt(
          command.options.cmdIdx,
          command.options.x,
          command.options.y,
          command.options.t,
          command.options.prevEndX,
          command.options.prevEndY,
        );
        el.buildHitArea();
        el.setDirtyAll();
      }
    });

    this.commandBus.register('PATH_CHANGE_NODE_TYPE', (command) => {
      if (command.type !== 'PATH_CHANGE_NODE_TYPE') return;
      const el = this.shapeManager
        .getAll()
        .find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.changeNodeType(command.options.cmdIdx, command.options.newType);
        el.buildHitArea();
        el.setDirtyAll();
      }
    });

    this.commandBus.register('PATH_REMOVE_NODE', (command) => {
      if (command.type !== 'PATH_REMOVE_NODE') return;
      const el = this.shapeManager
        .getAll()
        .find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.removeNodeAt(command.options.cmdIdx);
        el.buildHitArea();
        el.setDirtyAll();
      }
    });

    this.commandBus.register('PATH_MOVE_SUBPATH', (command) => {
      if (command.type !== 'PATH_MOVE_SUBPATH') return;
      const el = this.shapeManager
        .getAll()
        .find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.translateSubpath(
          command.options.subpathIdx,
          command.options.delta.x,
          command.options.delta.y,
        );
        el.buildHitArea();
        el.setDirtyAll();
      }
    });

    this.creationHandler = new CreationHandler(
      this.svg,
      this.camera,
      this.commandBus,
      (el) => this.addShape(el),
      (el) => this.shapeManager.remove(el.id),
    );
    this.creationHandler.onElementFinalize = (el) => {
      this.indexShape(el);
    };

    this._externalApi = new ExternalApi(this);

    const rootSvg = this.svg;

    rootSvg.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        this.creationHandler.handleMouseDown(e);
      },
      true,
    );

    window.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        this.creationHandler.handleMouseMove(e);
      },
      true,
    );

    window.addEventListener(
      'mouseup',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        this.creationHandler.handleMouseUp(e);
      },
      true,
    );

    rootSvg.addEventListener(
      'dblclick',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        this.creationHandler.handleDblClick(e);
      },
      true,
    );

    rootSvg.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.code === 'Space' && e.target === rootSvg) {
          console.log('Space pressed — pan mode (123)');
          e.preventDefault();
        }
      },
      true,
    );
    rootSvg.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        if (e.code === 'Space' && e.target === rootSvg) {
          console.log('Space released — pan mode off (123)');
        }
      },
      true,
    );

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        this.creationHandler.handleKeyDown(e);
      },
      true,
    );

    requestAnimationFrame(() => {
      this.timeMachine.captureRoot();
    });
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

  public on(
    event: string,
    fn: (event: import('./EventBus').BusEvent) => void,
  ): () => void {
    return this.events.on(event, fn);
  }
  public off(
    event: string,
    fn: (event: import('./EventBus').BusEvent) => void,
  ): void {
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
    this.selectionState.clear();
    this.groupManager.clearSelectedGroups();
    this.groupSelectionOverlay.clear();
    this.timeMachine.undo();
    this.reindexSpatialGrid();
  }

  public redo(): void {
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

  private getArtboardRect(): {
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

  // ---- Group API ----
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

  private createAbstractGraphicElement(
    options?: SvgCanvasOptions,
  ): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute(
      'viewBox',
      `0 0 ${options?.width ?? 800} ${options?.height ?? 600}`,
    );
    svg.style.display = 'block';
    return svg;
  }

  private indexShape(shape: AbstractGraphicElement): void {
    const bbox = shape.getTransformedBBox();
    this.spatialGrid.insert(shape.id, bbox.x, bbox.y, bbox.width, bbox.height);
  }

  private reindexSpatialGrid(): void {
    this.spatialGrid.clear();
    for (const el of this.shapeManager.getAll()) {
      const bbox = el.getTransformedBBox();
      this.spatialGrid.insert(el.id, bbox.x, bbox.y, bbox.width, bbox.height);
    }
  }

  private syncGroupSelectionOverlay(): void {
    const selectedGroups = Array.from(this.groupManager.selectedGroupIds)
      .map((id) => this.groupManager.getGroup(id))
      .filter((g): g is Group => g !== undefined);
    this.groupSelectionOverlay.sync(selectedGroups, (id) =>
      this.shapeManager.getAll().find((e) => e.id === id),
    );
  }
}
