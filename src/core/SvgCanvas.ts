import { Camera } from '@/canvas/Camera';
import { CanvasView } from '@/canvas/CanvasView';
import { RenderScheduler } from '@/canvas/RenderScheduler';
import { SvgNodeFactory } from '@/canvas/SvgNodeFactory';
import {
  Artboard,
  Background,
  Grid,
  Rulers,
  Selection,
  SelectionGroup,
} from '@/canvas/system';
import { ShapeManager } from '@/shapes/ShapeManager';
import { EventManager } from '@/events/EventManager';
import { SelectionState } from '@/canvas/overlays/selection/SelectionState';
import { SpatialGrid } from '@/math/spatial/SpatialGrid';
import { SelectionHandler } from '@/canvas/overlays/selection/handlers/SelectionHandler';
import { SelectionManager } from '@/canvas/overlays/selection/SelectionManager';
import { PathNodeOverlay } from '@/canvas/overlays/selection/PathNodeOverlay';
import { TransformHandler } from '@/canvas/overlays/selection/transform/TransformHandler';
import { GroupTransformHandler } from '@/canvas/overlays/selection/transform/GroupTransformHandler';
import { DebugOverlay } from '@/canvas/overlays/debug/DebugOverlay';
import { PreloaderOverlay } from '@/canvas/overlays/debug/PreloaderOverlay';
import { GridOverlay } from '@/canvas/overlays/debug/GridOverlay';
import { ColorMap } from '@/color/ColorMap';
import { GroupManager, type Group } from '@/shapes/group';
import { CommandBus } from '@/commands';
import { TimeMachine } from '@/time-machine';
import { RulerManager } from '@/canvas/system/ruler';
import { BooleanHandler } from '@/math/boolean';
import { CreationHandler } from '@/commands/handlers/creation/CreationHandler';
import { ExternalApi } from '@/api/external-api';
import { EventBus } from './EventBus';
import { CommandManager } from './internal/CommandManager';
import { OverlayCoordinator } from './internal/OverlayCoordinator';
import { ElementManager } from './internal/ElementManager';
import { SpatialIndexer } from './internal/SpatialIndexer';
import { ColorIndexer } from './internal/ColorIndexer';
import type { ICanvasContext } from './internal/types';
import { PathElement } from '@/shapes/elements/PathElement';
import type { SvgCanvasOptions } from '@/types';

function createSvgElement(options?: SvgCanvasOptions): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute(
    'viewBox',
    `0 0 ${options?.width ?? 800} ${options?.height ?? 600}`,
  );
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  svg.style.display = 'block';
  return svg;
}

export class SvgCanvas implements ICanvasContext {
  element!: HTMLElement;
  svg!: SVGSVGElement;
  camera!: Camera;
  view!: CanvasView;
  scheduler!: RenderScheduler;
  events!: EventBus;
  eventManager!: EventManager;
  panActive!: { value: boolean };

  artboard!: Artboard;
  background!: Background;
  grid!: Grid;
  rulers!: Rulers;
  selection!: Selection;
  selectionGroup!: SelectionGroup;

  shapeManager!: ShapeManager;
  spatialGrid!: SpatialGrid;
  selectionState!: SelectionState;
  colorMap!: ColorMap;

  commandBus!: CommandBus;
  timeMachine!: TimeMachine;

  selectionManager!: SelectionManager;
  pathNodeOverlay!: PathNodeOverlay;
  debugOverlay!: DebugOverlay;
  preloaderOverlay!: PreloaderOverlay;
  gridOverlay!: GridOverlay;

  transformHandler!: TransformHandler;
  groupTransformHandler!: GroupTransformHandler;

  groupManager!: GroupManager;
  elementManager!: ElementManager;
  rulerManager!: RulerManager;
  booleanHandler!: BooleanHandler;

  selectionHandler!: SelectionHandler;
  creationHandler!: CreationHandler;

  private _api!: ExternalApi;
  private _overlayCoordinator!: OverlayCoordinator;

  constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    this._initCore(container, options);
    this._initSystemNodes();
    this._initCommandAndHistory();
    this._initGroupManager();
    this._initOverlayInfrastructure();
    this._initElementManager();
    this._initManagers(options);
    this._createApi();
    this._wire();
    this._createHandlers();
    this._mount(container);
  }

  // ── Init steps ──

  private _initCore(container: HTMLElement, options?: SvgCanvasOptions): void {
    this.element = container;
    this.element.style.userSelect = 'none';
    (this.element.style as any).webkitUserSelect = 'none';

    const svg = createSvgElement(options);
    svg.setAttribute('tabindex', '0');
    this.svg = svg;

    const scheduler = new RenderScheduler();
    this.scheduler = scheduler;

    const camera = new Camera(scheduler.registerDirtyNode);
    this.camera = camera;

    const factory = new SvgNodeFactory();
    const view = new CanvasView(svg, factory, camera);
    this.view = view;
    scheduler.setView(view);

    const shapeManager = new ShapeManager(view);
    shapeManager.setRegisterDirty(scheduler.registerDirtyNode);
    this.shapeManager = shapeManager;

    this.eventManager = new EventManager(svg);
    this.selectionState = new SelectionState();
    this.spatialGrid = new SpatialGrid(100);
    this.panActive = { value: false };
    this.events = new EventBus();
    this.colorMap = new ColorMap();
    this.selectionManager = new SelectionManager(scheduler.registerDirtyNode);
    this.pathNodeOverlay = new PathNodeOverlay(camera);
  }

  private _initSystemNodes(): void {
    const reg = this.scheduler.registerDirtyNode;
    this.artboard = new Artboard(reg);
    this.background = new Background(this.svg, this.view.defs);
    this.grid = new Grid(reg);
    this.rulers = new Rulers(reg);
    this.selection = new Selection(reg);
    this.selectionGroup = new SelectionGroup(reg);

    this.view.initSystemNodes({
      artboard: this.artboard.id,
      grid: this.grid.id,
      rulers: this.rulers.id,
      selection: this.selection.id,
      'selection-group': this.selectionGroup.id,
    });
  }

  private _initCommandAndHistory(): void {
    this.timeMachine = new TimeMachine(this.shapeManager, 100);
    const commandBus = new CommandBus(this.events);
    this.commandBus = commandBus;
  }

  private _initGroupManager(): void {
    const gm = new GroupManager(null as never, () =>
      this.shapeManager.getAll(),
    );
    gm.setEvents(this.events);
    gm.setOnChange(() => this._overlayCoordinator?.syncGroups());
    this.groupManager = gm;
  }

  private _initElementManager(): void {
    this.elementManager = new ElementManager(
      this.shapeManager,
      this.selectionState,
      this.selectionManager,
      new SpatialIndexer(this.spatialGrid),
      this.timeMachine,
      this.events,
      new ColorIndexer(this.colorMap),
      this.commandBus,
    );
  }

  private _initOverlayInfrastructure(): void {
    const overlayRoot = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    this.svg.appendChild(overlayRoot);

    overlayRoot.appendChild(this.pathNodeOverlay.getElement());

    this.selectionState.setOnChange((selected) => {
      this.selectionManager.setElementSelection(
        selected.map((e) => e.id),
        (id) => this.shapeManager.getById(id),
      );
    });

    this.transformHandler = new TransformHandler(
      this.camera as any,
      this.timeMachine,
    );
    this.groupTransformHandler = new GroupTransformHandler(
      this.camera as any,
      this.timeMachine,
    );

    this.debugOverlay = new DebugOverlay(this.camera as any);
    overlayRoot.appendChild(this.debugOverlay.getElement());

    this.preloaderOverlay = new PreloaderOverlay();
    this.preloaderOverlay.hide();
    overlayRoot.appendChild(this.preloaderOverlay.getElement());

    this.gridOverlay = new GridOverlay(this.camera as any, () => ({
      width: this.artboard.widthPx,
      height: this.artboard.heightPx,
    }));
    this.view.cameraGroup.appendChild(this.gridOverlay.getElement());
  }

  private _initManagers(options?: SvgCanvasOptions): void {
    this.rulerManager = new RulerManager(
      this.camera as any,
      this.events,
      this.svg,
      options?.width ?? 800,
      options?.height ?? 600,
    );
    const overlayRoot = this.svg.querySelector('g')!;
    overlayRoot.appendChild(this.rulerManager.root);

    this.booleanHandler = new BooleanHandler(
      this.svg,
      this.selectionState,
      this.shapeManager,
      this.spatialGrid,
      this.events,
      this.commandBus,
    );
  }

  private _createApi(): void {
    this._api = new ExternalApi(this);
  }

  private _wire(): void {
    new CommandManager(this).registerAll();
    this._overlayCoordinator = new OverlayCoordinator(this);
    this._overlayCoordinator.wire();
    this.groupManager.setOnChange(() => this._overlayCoordinator.syncGroups());
  }

  private _createHandlers(): void {
    const creationHandler = new CreationHandler(
      this.svg,
      this.camera as any,
      this.commandBus,
      (el) => this.elementManager.addShape(el),
      (el) => this.shapeManager.remove(el.id),
    );
    creationHandler.onElementFinalize = (el) => {
      this.elementManager.indexShape(el);
    };
    this.creationHandler = creationHandler;

    const onGroupSelect = (ids: string[]): void => {
      this.selectionState.clear();
      this.groupManager.setSelectedGroupIds(ids);
      this._overlayCoordinator.syncGroups();
    };

    let dragOverlayDx = 0;
    let dragOverlayDy = 0;

    this.selectionHandler = new SelectionHandler({
      svg: this.svg,
      camera: this.camera as any,
      selectionManager: this.selectionManager,
      pathNodeOverlay: this.pathNodeOverlay,
      transformHandler: this.transformHandler,
      groupTransformHandler: this.groupTransformHandler,
      state: this.selectionState,
      getElements: () => this.shapeManager.getAll(),
      grid: this.spatialGrid,
      bus: this.commandBus,
      registerDirty: this.scheduler.registerDirtyNode,
      timeMachine: this.timeMachine,
      isPanning: () => this.panActive.value,
      isCreating: () => creationHandler.activeType !== null,
      isGuidelineDragging: () => this.rulerManager.isDragging,
      getGroupIdForElement: (elementId) =>
        this.groupManager.getGroupByElement(elementId)?.id,
      getSelectedGroups: () =>
        Array.from(this.groupManager.selectedGroupIds)
          .map((id) => this.groupManager.getGroup(id))
          .filter((g): g is Group => g !== undefined),
      onGroupSelect,
      getArtboardRect: () =>
        this.artboard
          ? {
              x: 0,
              y: 0,
              width: this.artboard.widthPx,
              height: this.artboard.heightPx,
            }
          : null,
      onDragStart: () => {
        dragOverlayDx = 0;
        dragOverlayDy = 0;
      },
      onDragMove: (dx: number, dy: number) => {
        const frameDx = dx - dragOverlayDx;
        const frameDy = dy - dragOverlayDy;
        dragOverlayDx = dx;
        dragOverlayDy = dy;
        this.selectionManager.moveBy(frameDx, frameDy);
      },
      onDragEnd: () => {
        dragOverlayDx = 0;
        dragOverlayDy = 0;
      },
      onSetEditingPath: (el) => {
        this._api.editingPath = el ? (el as PathElement) : null;
      },
      getEditingPath: () => this._api.editingPath,
      getGuidelines: () => this.rulerManager.getGuidelines(),
      getGridLines: () => this.gridOverlay.getGridLines(),
      events: this.events,
    });
  }

  private _mount(container: HTMLElement): void {
    container.appendChild(this.svg);
    this.eventManager.register(this.creationHandler);
    this.eventManager.register(this.booleanHandler);
    this.eventManager.register(this.selectionHandler);
    this.eventManager.bind();
    requestAnimationFrame(() => {
      this.timeMachine.captureRoot();
    });
  }

  // ── Public API ──

  get api(): ExternalApi {
    return this._api;
  }
}
