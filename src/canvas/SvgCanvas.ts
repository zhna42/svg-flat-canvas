import { Camera } from '@/canvas/Camera';
import { CanvasLayers } from '@/canvas/CanvasLayers';
import { CanvasView } from '@/canvas/CanvasView';
import { CanvasSystemNodes } from '@/canvas/CanvasSystemNodes';
import { RenderScheduler } from '@/canvas/RenderScheduler';
import { SvgNodeFactory } from '@/canvas/SvgNodeFactory';
import {
  Artboard,
  Background,
  Grid,
  Rulers,
  Selection,
  SelectionGroup,
} from '@/canvas/nodes';
import { ShapeManager } from '@/manager/ShapeManager';
import { DOMEventCoordinator } from '@/core/event-bus/DOMEventCoordinator';
import { SelectionState } from '@/canvas/overlays/selection/SelectionState';
import { HitTestEngine } from '@/core/hit-test';
import { SelectionHandler } from '@/canvas/overlays/selection/handlers/SelectionHandler';
import { SelectionManager } from '@/canvas/overlays/selection/SelectionManager';
import { PathNodeOverlay } from '@/canvas/overlays/selection/PathNodeOverlay';
import { NodeEditCoordinator } from '@/canvas/overlays/nodeedit/NodeEditCoordinator';
import { NodeEditOverlayElement } from '@/core/shapes/elements/NodeEditOverlayElement';
import { MeasureCoordinator } from '@/canvas/overlays/measure/MeasureCoordinator';
import {
  LaserGroupManager,
  LaserSettings,
  LaserColorResolver,
} from '@/modules/laser';
import {
  CutParamsGrading,
  CutParamsRenderer,
  CutParamsController,
} from '@/modules/cut-params';
import { CadTextEngine } from '@/modules/text/CadTextEngine';
import { FontService } from '@/modules/text';
import { TransformHandler } from '@/canvas/overlays/selection/transform/TransformHandler';
import { GroupTransformHandler } from '@/canvas/overlays/selection/transform/GroupTransformHandler';
import { DebugOverlay } from '@/canvas/overlays/debug/DebugOverlay';
import { PreloaderOverlay } from '@/canvas/overlays/debug/PreloaderOverlay';
import { GridOverlay } from '@/canvas/overlays/debug/GridOverlay';
import { ColorMap } from '@/core/color/ColorMap';
import { GroupManager } from '@/manager/GroupManager';
import type { Group } from '@/core/shapes/group';
import { CommandBus } from '@/core/commands/CommandBus';
import { TimeMachine } from '@/manager/time-machine';
import { GuidelineManager } from '@/modules/ruler';
import { BooleanHandler } from '@/manager/commands/handlers/BooleanHandler';
import { CreationHandler } from '@/manager/commands/handlers/creation/CreationHandler';
import { ExternalApi } from '@/modules/api/ExternalApi';
import { EventBus } from '@/core/event-bus/EventBus';
import { CommandManager } from '@/manager/commands/CommandManager';
import { OverlayCoordinator } from '@/canvas/overlays/OverlayCoordinator';
import { ElementManager } from '@/manager/ElementManager';
import { ColorIndexer } from '@/manager/ColorIndexer';
import type { ICanvasContext } from '@/canvas/types';
import { PathElement } from '@/core/shapes/elements/PathElement';
import { MM_TO_PX } from '@/constants';
import type { SvgCanvasOptions } from '@/core/type';

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
  eventManager!: DOMEventCoordinator;
  panActive!: { value: boolean };

  artboard!: Artboard;
  background!: Background;
  grid!: Grid;
  rulers!: Rulers;
  selection!: Selection;
  selectionGroup!: SelectionGroup;

  shapeManager!: ShapeManager;
  hitTestEngine!: HitTestEngine;
  selectionState!: SelectionState;
  colorMap!: ColorMap;

  commandBus!: CommandBus;
  timeMachine!: TimeMachine;

  selectionManager!: SelectionManager;
  pathNodeOverlay!: PathNodeOverlay;
  nodeEdit!: NodeEditCoordinator;
  measure!: MeasureCoordinator;
  debugOverlay!: DebugOverlay;
  preloaderOverlay!: PreloaderOverlay;
  gridOverlay!: GridOverlay;

  transformHandler!: TransformHandler;
  groupTransformHandler!: GroupTransformHandler;

  groupManager!: GroupManager;
  elementManager!: ElementManager;
  guidelineManager!: GuidelineManager;
  booleanHandler!: BooleanHandler;

  laserGroupManager!: LaserGroupManager;
  laserSettings!: LaserSettings;
  laserColorResolver!: LaserColorResolver;
  cutParamsGrading!: CutParamsGrading;
  cutParamsRenderer!: CutParamsRenderer;
  cutParamsController!: CutParamsController;

  textEngine!: CadTextEngine;
  fonts!: FontService;

  selectionHandler!: SelectionHandler;
  creationHandler!: CreationHandler;

  public maskMode: { imageId: string } | null = null;

  private _api!: ExternalApi;
  private _overlayCoordinator!: OverlayCoordinator;

  constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    this._initCore(container, options);
    this._initSystemNodes();
    this._initCommandAndHistory();
    this._initGroupManager();
    this._initLaserModule();
    this._initOverlayInfrastructure();
    this._initElementManager();
    this._initTextEngine();
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
    (
      this.element.style as unknown as Record<string, unknown>
    ).webkitUserSelect = 'none';

    const svg = createSvgElement(options);
    svg.setAttribute('tabindex', '0');
    this.svg = svg;

    const scheduler = new RenderScheduler();
    this.scheduler = scheduler;

    const camera = new Camera(scheduler.registerDirtyNode);
    this.camera = camera;

    const factory = new SvgNodeFactory();
    const layers = new CanvasLayers(svg);
    const view = new CanvasView(svg, factory, camera, layers);
    this.view = view;
    scheduler.setView(view);

    const shapeManager = new ShapeManager(view);
    shapeManager.setRegisterDirty(scheduler.registerDirtyNode);
    this.shapeManager = shapeManager;

    view._onImageMoved = (imageId, oldMatrix, newMatrix) => {
      shapeManager.moveMaskElements(imageId, oldMatrix, newMatrix);
      shapeManager.updateMaskBBox(imageId);
    };
    view._onElementRedrawn = (elementId) => {
      const maskedIds = shapeManager.getMaskedImageIds(elementId);
      for (const mid of maskedIds) shapeManager.updateMaskBBox(mid);
    };

    view.setFlexTreeProvider(
      (id) => shapeManager.getById(id)?.flexTree ?? null,
    );

    this.eventManager = new DOMEventCoordinator(svg);
    this.selectionState = new SelectionState();
    this.hitTestEngine = new HitTestEngine(10000);
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

  private _initLaserModule(): void {
    this.laserSettings = new LaserSettings();
    this.laserGroupManager = new LaserGroupManager(() =>
      this.shapeManager.getAll(),
    );
    this.laserGroupManager.setEvents(this.events);
    this.laserColorResolver = new LaserColorResolver(
      this.laserGroupManager,
      this.laserSettings,
      (id) => this.shapeManager.getById(id),
    );
    this.laserGroupManager.onDeselectElements = (ids) => {
      const keep = this.selectionState.selected.filter(
        (e) => !ids.includes(e.id),
      );
      this.selectionState.replace(keep);
    };
    this.view.setLaserStyleProvider((id: string) => {
      const maskOverride = this._getMaskStyle(id);
      if (maskOverride) return maskOverride;
      return this.laserColorResolver.resolve(id);
    });

    this.cutParamsGrading = new CutParamsGrading(
      this.laserGroupManager,
      this.laserSettings,
      () =>
        this.shapeManager
          .getAll()
          .filter(
            (e) => !e.isPreview && !CanvasSystemNodes.isSystem(e.id),
          ),
    );
    this.cutParamsRenderer = new CutParamsRenderer(this.cutParamsGrading);
    this.cutParamsController = new CutParamsController(
      this.cutParamsRenderer,
    );
    this.cutParamsController.bindMode(
      (enabled) => this._setCutParamsMode(enabled),
      () => this.cutParamsRenderer.isActive(),
    );

    this.laserGroupManager.setOnChange(() => {
      this._refreshLaser();
      if (this.cutParamsRenderer.isActive()) {
        this.cutParamsRenderer.refresh();
        this.view.refreshLaserStyles();
        this.events.emit('CUT_PARAMS_GRADING_CHANGED', {
          grading: this.cutParamsRenderer.getGradingResults(),
        });
      }
    });
  }

  private _setCutParamsMode(enabled: boolean): void {
    if (enabled) {
      this.view.setModeStyleProvider(
        (id) => this.cutParamsRenderer.getStyleOverride(id),
      );
      this.cutParamsRenderer.setActive(true);
      this.view.refreshLaserStyles();
      this.events.emit('CUT_PARAMS_MODE_CHANGED', { enabled: true });
      this.events.emit('CUT_PARAMS_GRADING_CHANGED', {
        grading: this.cutParamsRenderer.getGradingResults(),
      });
    } else {
      this.cutParamsRenderer.setActive(false);
      this.view.setModeStyleProvider(null);
      this.view.refreshLaserStyles();
      this.events.emit('CUT_PARAMS_MODE_CHANGED', { enabled: false });
    }
  }

  private _isCutParamsMode(): boolean {
    return this.cutParamsRenderer.isActive();
  }

  /** Пересчёт градации + переприменение стилей + отрисовка. */
  public _refreshLaser(): void {
    this.laserColorResolver.recompute();
    this.view.refreshLaserStyles();
    this.events.emit('LASER_COLOR_GRADING_CHANGED', {
      mapping: this.laserColorResolver.getGrading(),
    });
  }

  /** Стилевой индикатор: если элемент используется как маска — подсвечиваем. */
  private _getMaskStyle(
    id: string,
  ): import('@/modules/laser/laser-types').LaserStyleOverride | null {
    const maskedImageIds = this.shapeManager.getMaskedImageIds(id);
    if (maskedImageIds.length > 0) {
      return { fill: 'none', stroke: '#ff00ff', opacity: 0.5 };
    }
    return null;
  }

  private _initElementManager(): void {
    this.elementManager = new ElementManager(
      this.shapeManager,
      this.selectionState,
      this.selectionManager,
      this.hitTestEngine,
      this.timeMachine,
      this.events,
      new ColorIndexer(this.colorMap),
      this.commandBus,
    );
  }

  private _initTextEngine(): void {
    this.fonts = new FontService();

    this.textEngine = new CadTextEngine({
      svg: this.svg,
      camera: this.camera,
      fonts: this.fonts,
      getTextElement: (id) => {
        const el = this.shapeManager.getById(id);
        if (el?.type === 'text')
          return el as import('@/core/shapes/elements/TextElement').TextElement;
        return undefined;
      },
      getTextSvg: (id) => this.view.getTextSvgElement(id),
      deleteElement: (id) => this._api.shapes.deleteElement(id),
      hitTest: (x, y) =>
        this.hitTestEngine.queryPoint(x, y).hits.map((h) => h.id),
      onUndo: () => this.timeMachine.undo(),
      onRedo: () => this.timeMachine.redo(),
    });
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
      if (selected.length === 1) {
        const bbox = selected[0].getTransformedBBox();
        this.events.emit('ELEMENT_SIZE', {
          id: selected[0].id,
          xMm: bbox.x / MM_TO_PX,
          yMm: bbox.y / MM_TO_PX,
          widthMm: bbox.width / MM_TO_PX,
          heightMm: bbox.height / MM_TO_PX,
          angleDeg: selected[0].transform.angle,
        });
      } else {
        this.events.emit('ELEMENT_SIZE', {
          id: null,
          xMm: 0,
          yMm: 0,
          widthMm: 0,
          heightMm: 0,
          angleDeg: 0,
        });
      }
    });

    this.selectionState.setOnModeChange(() => {
      this.selectionState.clear();
      if (this.groupManager.selectedGroupIds.size > 0) {
        this.groupManager.setSelectedGroupIds([]);
      }
      this._overlayCoordinator?.syncGroups();
    });

    this.transformHandler = new TransformHandler(this.camera, this.timeMachine);
    this.groupTransformHandler = new GroupTransformHandler(
      this.camera,
      this.timeMachine,
    );

    this.debugOverlay = new DebugOverlay(this.camera);
    overlayRoot.appendChild(this.debugOverlay.getElement());

    this.preloaderOverlay = new PreloaderOverlay();
    this.preloaderOverlay.hide();
    overlayRoot.appendChild(this.preloaderOverlay.getElement());

    this.gridOverlay = new GridOverlay(this.camera, () => ({
      width: this.artboard.widthPx,
      height: this.artboard.heightPx,
    }));
    this.view.cameraGroup.appendChild(this.gridOverlay.getElement());

    const overlayEl = new NodeEditOverlayElement('node-edit-overlay');
    this.shapeManager.add(overlayEl);

    this.nodeEdit = new NodeEditCoordinator({
      camera: this.camera,
      getElement: (id) => this.shapeManager.getById(id),
      getAllElements: () => this.shapeManager.getAll(),
      convertToPath: (id) => this._convertToPath(id),
      getOverlayElement: () => overlayEl,
      onEnter: (ids) => this.events.emit('NODE_EDIT_ENTERED', { ids }),
      onExit: () => this.events.emit('NODE_EDIT_EXITED', {}),
      onSelectionChange: (count) =>
        this.events.emit('NODE_SELECTION_CHANGED', { count }),
      hideSelectionOverlay: () => this.selectionManager.clear(),
      restoreSelectionOverlay: () =>
        this.selectionManager.setElementSelection(
          this.selectionState.selected.map((e) => e.id),
          (id) => this.shapeManager.getById(id),
        ),
    });

    this.measure = new MeasureCoordinator({
      camera: this.camera,
      svg: this.svg,
      getElements: () => this.shapeManager.getAll(),
      hitTestEngine: this.hitTestEngine,
      onToolChange: (tool) =>
        this.events.emit('MEASURE_TOOL_CHANGED', { tool }),
      onAdded: (result) => this.events.emit('MEASURE_ADDED', { result }),
    });
    overlayRoot.appendChild(this.measure.renderer.getElement());
  }

  private _convertToPath(id: string): PathElement | null {
    const el = this.shapeManager.getById(id);
    if (!el) return null;
    if (el instanceof PathElement) return el;

    const path = new PathElement(el.id);
    path.style.fill = el.style.fill;
    path.style.stroke = el.style.stroke;
    path.style.strokeWidth = el.style.strokeWidth;
    path.style.opacity = el.style.opacity;
    path.style.visible = el.style.visible;
    path.groupId = el.groupId;
    path.name = el.name;
    path.setVisible(el.visible);
    path.lock = el.lock;
    path.isEditingNodes = el.isEditingNodes;
    path.transform.matrix = new DOMMatrix(el.transform.matrix.toString());

    this.view.remove(el.id);
    this.hitTestEngine.remove(el.id);
    this.shapeManager.remove(el.id);
    this.elementManager.addShape(path);
    return path;
  }

  private _initManagers(options?: SvgCanvasOptions): void {
    void options;
    this.guidelineManager = new GuidelineManager(
      this.camera,
      this.events,
      this.svg,
      this.scheduler.registerDirtyNode,
      (id) => this.view.remove(id),
    );

    this.booleanHandler = new BooleanHandler(
      this.svg,
      this.selectionState,
      this.shapeManager,
      this.hitTestEngine,
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
    this._wireRulerSync();
  }

  private _wireRulerSync(): void {
    const refresh = (): void => {
      this.rulers.syncCamera(this.camera.x, this.camera.y, this.camera.zoom);
      this.rulers.bumpViewport();
      this.guidelineManager.onCameraChange();
    };
    const ro = new ResizeObserver(refresh);
    ro.observe(this.svg);
    refresh();
  }

  private _createHandlers(): void {
    const creationHandler = new CreationHandler(
      this.svg,
      this.camera,
      this.commandBus,
      (el) => this.elementManager.addShape(el),
      (el) => this.shapeManager.remove(el.id),
    );
    creationHandler.onElementFinalize = (el) => {
      this.elementManager.indexShape(el);
    };
    creationHandler.onCreationEnd = (el) => {
      creationHandler.setActiveType(null);
      this.selectionState.replace([el]);
      if (el.type === 'text') {
        this.textEngine.enterEdit(el.id);
      }
      this.events.emit('CREATION_TOOL_DEACTIVATED', { elementId: el.id });
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
      camera: this.camera,
      selectionManager: this.selectionManager,
      pathNodeOverlay: this.pathNodeOverlay,
      nodeEdit: this.nodeEdit,
      transformHandler: this.transformHandler,
      groupTransformHandler: this.groupTransformHandler,
      state: this.selectionState,
      getElements: () => this.shapeManager.getAll(),
      hitTestEngine: this.hitTestEngine,
      bus: this.commandBus,
      registerDirty: this.scheduler.registerDirtyNode,
      timeMachine: this.timeMachine,
      isPanning: () => this.panActive.value,
      isCreating: () => creationHandler.activeType !== null,
      isGuidelineDragging: () => this.guidelineManager.isDragging,
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
        this._api.nodeEdit.editingPath = el ? (el as PathElement) : null;
      },
      getEditingPath: () => this._api.nodeEdit.editingPath,
      canInteract: (id) => {
        if (this.maskMode) {
          if (this.shapeManager.getById(id)?.type === 'image') return false;
        } else {
          if (this.shapeManager.getMaskedImageIds(id).length > 0) return false;
        }
        return this.laserGroupManager.canInteract(id);
      },
      canMove: (id) => {
        if (this.maskMode && this.shapeManager.getById(id)?.type === 'image')
          return false;
        if (
          this._isCutParamsMode() &&
          !this.cutParamsController.movable
        )
          return false;
        return this.laserGroupManager.canMove(id);
      },
      isTextEditing: () => this.textEngine.isEditing,
      onTextEdit: (el) => this.textEngine.enterEdit(el.id),
      getGuidelines: () => this.guidelineManager.getGuidelines(),
      getGridLines: () => this.gridOverlay.getGridLines(),
      events: this.events,
    });
  }

  private _mount(container: HTMLElement): void {
    container.appendChild(this.svg);
    this.eventManager.register(this.creationHandler);
    this.eventManager.register(this.booleanHandler);
    this.eventManager.register(this.selectionHandler);
    this.eventManager.register(this.measure);
    this.eventManager.register(this.textEngine);
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
