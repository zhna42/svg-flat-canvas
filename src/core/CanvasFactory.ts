import { EventManager } from '@/events/EventManager';
import { Renderer } from '@/renderer/Renderer';
import { ShapeManager } from '@/shapes/ShapeManager';
import { Camera } from '@/camera/Camera';
import type { SvgCanvasOptions } from '@/types';
import { SelectionState } from '@/selection/SelectionState';
import { SpatialGrid } from '@/spatial/SpatialGrid';
import { MM_TO_PX } from '@/constants';
import { SelectionHandler } from '@/selection/handlers/SelectionHandler';
import { SelectionOverlay } from '@/selection/overlay/SelectionOverlay';
import { GroupSelectionOverlay } from '@/selection/overlay/GroupSelectionOverlay';
import { TransformHandler } from '@/selection/transform/TransformHandler';
import { DebugOverlay } from '@/debug/DebugOverlay';
import { PreloaderOverlay } from '@/debug/PreloaderOverlay';
import { GridOverlay } from '@/debug/GridOverlay';
import { RulerManager } from '@/ruler';
import { BooleanHandler } from '@/boolean';
import { CreationHandler } from '@/creation/CreationHandler';
import { GroupManager } from '@/group';
import { EventBus } from './EventBus';
import { CommandBus } from '@/commands';
import { TimeMachine } from '@/time-machine';
import { createSelectHandler } from '@/commands/handlers/select-handler';
import {
  createDragMoveHandler,
  createDragEndHandler,
} from '@/commands/handlers/drag-handler';
import { createGroupHandler } from '@/commands/handlers/group-handler';
import { createDeleteHandler } from '@/commands/handlers/delete-handler';
import { createCreateHandler } from '@/commands/handlers/create-handler';
import { createCreateFileHandler } from '@/commands/handlers/create-file-handler';
import { createBooleanOperationHandler } from '@/commands/handlers/boolean-handler';
import { ExternalApi } from '@/api/external-api';
import { PathElement } from '@/shapes/elements/PathElement';
import { SvgCanvas } from './SvgCanvas';

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

export class CanvasFactory {
  static create(container: HTMLElement, options?: SvgCanvasOptions): SvgCanvas {
    const element = container;
    element.style.userSelect = 'none';
    element.style.webkitUserSelect = 'none';

    const svg = createSvgElement(options);
    svg.setAttribute('tabindex', '0');

    const camera = new Camera();
    const renderer = new Renderer(svg, camera);
    camera.cameraGroup = renderer.getCameraGroup();
    const shapeManager = new ShapeManager(renderer);
    const eventManager = new EventManager(svg);
    const selectionState = new SelectionState();
    const spatialGrid = new SpatialGrid(100);

    const panActive = { value: false };
    const events = new EventBus();

    const timeMachine = new TimeMachine(shapeManager, 100);
    const commandBus = new CommandBus(timeMachine, events);
    commandBus.setGetElement((id) => shapeManager.getById(id));
    commandBus.setGetSelected(() =>
      Array.from(selectionState.selected).map((e) => e.id),
    );

    const selectionOverlay = new SelectionOverlay(camera);
    selectionState.setOnChange((selected) => {
      selectionOverlay.setElements(selected);
    });

    const transformHandler = new TransformHandler(camera, commandBus);

    const overlayRoot = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    svg.appendChild(overlayRoot);

    overlayRoot.appendChild(selectionOverlay.getElement());

    const groupSelectionOverlay = new GroupSelectionOverlay(camera);
    overlayRoot.appendChild(groupSelectionOverlay.getElement());

    const debugOverlay = new DebugOverlay(camera);
    overlayRoot.appendChild(debugOverlay.getElement());
    const debugShowHitArea = options?.debugShowHitArea ?? false;

    const preloaderOverlay = new PreloaderOverlay();
    preloaderOverlay.hide();
    overlayRoot.appendChild(preloaderOverlay.getElement());

    const gridOverlay = new GridOverlay(camera, () => {
      const artboard = renderer.getArtboard();
      return {
        width: artboard.widthMM * MM_TO_PX,
        height: artboard.heightMM * MM_TO_PX,
      };
    });
    renderer.getCameraGroup().appendChild(gridOverlay.getElement());

    const rulerManager = new RulerManager(
      camera,
      events,
      svg,
      options?.width ?? 800,
      options?.height ?? 600,
    );
    overlayRoot.appendChild(rulerManager.root);

    const booleanHandler = new BooleanHandler(
      svg,
      selectionState,
      shapeManager,
      spatialGrid,
      events,
      commandBus,
    );

    const canvas = Object.create(SvgCanvas.prototype) as SvgCanvas;
    const c = canvas as unknown as Record<string, unknown>;

    c.element = element;
    c.svg = svg;
    c.camera = camera;
    c.renderer = renderer;
    c.shapeManager = shapeManager;
    c.eventManager = eventManager;
    c.selectionState = selectionState;
    c.spatialGrid = spatialGrid;
    c.timeMachine = timeMachine;
    c.commandBus = commandBus;
    c.selectionOverlay = selectionOverlay;
    c.groupSelectionOverlay = groupSelectionOverlay;
    c.transformHandler = transformHandler;
    c.debugOverlay = debugOverlay;
    c.preloaderOverlay = preloaderOverlay;
    c.gridOverlay = gridOverlay;
    c.rulerManager = rulerManager;
    c.booleanHandler = booleanHandler;
    c._debugShowHitArea = debugShowHitArea;
    c._editingPath = null;
    c.panActive = panActive;
    c.events = events;

    const creationHandler = new CreationHandler(
      svg,
      camera,
      commandBus,
      (el) => canvas.addShape(el),
      (el) => shapeManager.remove(el.id),
    );
    creationHandler.onElementFinalize = (el) => {
      canvas.indexShape(el);
    };
    c.creationHandler = creationHandler;

    function updateOverlay(): void {
      const selected = selectionState.selected;
      if (selected.length > 0) {
        selectionOverlay.setPositions(selected);
      }
      if (groupManager.selectedGroupIds.size > 0) {
        canvas.syncGroupSelectionOverlay();
      }
    }

    transformHandler.onTransformEnd = () => {
      updateOverlay();
    };

    transformHandler.onTransformMove = () => {
      const selected = selectionState.selected;
      if (selected.length > 0) {
        selectionOverlay.setPositions(selected);
      }
    };

    camera.onChange = () => {
      const selected = selectionState.selected;
      if (selected.length > 0) {
        selectionOverlay.setPositions(selected);
      }
      if (canvas.editingPath) {
        selectionOverlay.updatePathNodes(canvas.editingPath);
      }
      if (groupManager.selectedGroupIds.size > 0) {
        canvas.syncGroupSelectionOverlay();
      }
      rulerManager.onCameraChange();
    };

    commandBus.register(
      'SELECT',
      createSelectHandler({
        state: selectionState,
        getElements: () => shapeManager.getAll(),
        grid: spatialGrid,
        lookupGroup: (elementId) =>
          groupManager.getGroupByElement(elementId)?.id,
      }),
    );

    const dragCtx = {
      getElements: () => shapeManager.getAll(),
      onDragEnd: (_ids: string[]) => {
        updateOverlay();
      },
    };
    commandBus.register('DRAG_MOVE', createDragMoveHandler(dragCtx));
    commandBus.register('DRAG_END', createDragEndHandler(dragCtx));

    const onGroupSelect = (ids: string[]): void => {
      selectionState.clear();
      groupManager.setSelectedGroupIds(ids);
      canvas.syncGroupSelectionOverlay();
    };

    let dragOverlayDx = 0;
    let dragOverlayDy = 0;

    const selectionHandler = new SelectionHandler({
      svg,
      camera,
      overlayRoot,
      selectionOverlay,
      transformHandler,
      state: selectionState,
      getElements: () => shapeManager.getAll(),
      grid: spatialGrid,
      bus: commandBus,
      isPanning: () => panActive.value,
      isCreating: () => creationHandler.isActive,
      isGuidelineDragging: () => rulerManager.isDragging,
      getGroupIdForElement: (elementId) =>
        groupManager.getGroupByElement(elementId)?.id,
      onGroupSelect,
      getArtboardRect: () => canvas.getArtboardRect(),
      onDragStart: () => {
        dragOverlayDx = 0;
        dragOverlayDy = 0;
      },
      onDragMove: (dx: number, dy: number) => {
        const frameDx = dx - dragOverlayDx;
        const frameDy = dy - dragOverlayDy;
        dragOverlayDx = dx;
        dragOverlayDy = dy;
        const zoom = camera.zoom;
        const screenDx = frameDx * zoom;
        const screenDy = frameDy * zoom;
        for (const overlayEl of selectionOverlay.getOverlayElements()) {
          overlayEl.translateBy(screenDx, screenDy);
        }
        groupSelectionOverlay.translateBy(screenDx, screenDy);
      },
      onDragEnd: () => {
        dragOverlayDx = 0;
        dragOverlayDy = 0;
      },
      onSetEditingPath: (el) => {
        if (el) {
          canvas.editingPath = el as PathElement;
        } else {
          canvas.editingPath = null;
        }
      },
      getEditingPath: () => canvas.editingPath,
      getGuidelines: () => rulerManager.getGuidelines(),
      getGridLines: () => gridOverlay.getGridLines(),
    });

    element.appendChild(svg);

    const groupManager = new GroupManager(null as never, () =>
      shapeManager.getAll(),
    );
    groupManager.setEvents(events);
    groupManager.setOnChange(() => {
      canvas.syncGroupSelectionOverlay();
    });

    commandBus.register('GROUP_CREATE', createGroupHandler(groupManager));
    commandBus.register('GROUP_DELETE', createGroupHandler(groupManager));
    commandBus.register('GROUP_ADD', createGroupHandler(groupManager));
    commandBus.register('GROUP_REMOVE', createGroupHandler(groupManager));
    commandBus.register('GROUP_CLEAR', createGroupHandler(groupManager));
    commandBus.register('DELETE', createDeleteHandler(shapeManager, spatialGrid));
    commandBus.register('CREATE', createCreateHandler(shapeManager));
    commandBus.register(
      'BOOLEAN_OPERATION',
      createBooleanOperationHandler(shapeManager, timeMachine, spatialGrid, (el) => {
        el.onSpatialIndexChanged = (element) => {
          canvas.reindexElement(element);
        };
      }),
    );
    commandBus.register(
      'CREATE_FILE',
      createCreateFileHandler(shapeManager, groupManager, (el) =>
        canvas.indexShape(el),
      ),
    );
    commandBus.register('ROTATE', (command) => {
      if (command.type !== 'ROTATE') return;
      for (const id of command.options.elementIds) {
        canvas.rotateElement(id, command.options.angle);
      }
    });

    commandBus.register('RESIZE', (command) => {
      if (command.type !== 'RESIZE') return;
      for (const id of command.options.elementIds) {
        canvas.resizeElement(
          id,
          command.options.bbox.width,
          command.options.bbox.height,
        );
      }
    });

    commandBus.register('TRANSFORM', (command) => {
      if (command.type !== 'TRANSFORM') return;
      for (const id of command.options.elementIds) {
        canvas.transformElement(id, command.options.matrix);
      }
    });

    commandBus.register('GEOMETRY_MUTATE', (command) => {
      if (command.type !== 'GEOMETRY_MUTATE') return;
      const el = shapeManager.getAll().find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.geometry.commands = command.options.newCommands;
        el.markRenderKey('d');
        el.rebuildHitArea();
        el.setDirtyAll();
      }
    });

    commandBus.register('PATH_ADD_NODE', (command) => {
      if (command.type !== 'PATH_ADD_NODE') return;
      const el = shapeManager.getAll().find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.addNodeAt(
          command.options.cmdIdx,
          command.options.x,
          command.options.y,
          command.options.t,
          command.options.prevEndX,
          command.options.prevEndY,
        );
        el.rebuildHitArea();
        el.setDirtyAll();
      }
    });

    commandBus.register('PATH_CHANGE_NODE_TYPE', (command) => {
      if (command.type !== 'PATH_CHANGE_NODE_TYPE') return;
      const el = shapeManager.getAll().find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.changeNodeType(command.options.cmdIdx, command.options.newType);
        el.rebuildHitArea();
        el.setDirtyAll();
      }
    });

    commandBus.register('PATH_REMOVE_NODE', (command) => {
      if (command.type !== 'PATH_REMOVE_NODE') return;
      const el = shapeManager.getAll().find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.removeNodeAt(command.options.cmdIdx);
        el.rebuildHitArea();
        el.setDirtyAll();
      }
    });

    commandBus.register('PATH_MOVE_SUBPATH', (command) => {
      if (command.type !== 'PATH_MOVE_SUBPATH') return;
      const el = shapeManager.getAll().find((e) => e.id === command.options.id);
      if (el instanceof PathElement) {
        el.translateSubpath(
          command.options.subpathIdx,
          command.options.delta.x,
          command.options.delta.y,
        );
        el.rebuildHitArea();
        el.setDirtyAll();
      }
    });

    c.selectionHandler = selectionHandler;
    c.groupManager = groupManager;

    const externalApi = new ExternalApi(canvas);
    c._externalApi = externalApi;

    const rootSvg = svg;

    rootSvg.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        creationHandler.handleMouseDown(e);
      },
      true,
    );

    window.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        creationHandler.handleMouseMove(e);
      },
      true,
    );

    window.addEventListener(
      'mouseup',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        creationHandler.handleMouseUp(e);
      },
      true,
    );

    rootSvg.addEventListener(
      'dblclick',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        creationHandler.handleDblClick(e);
      },
      true,
    );

    rootSvg.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.code === 'Space' && e.target === rootSvg) {
          e.preventDefault();
        }
      },
      true,
    );
    rootSvg.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        if (e.code === 'Space' && e.target === rootSvg) {
        }
      },
      true,
    );

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        creationHandler.handleKeyDown(e);
      },
      true,
    );

    requestAnimationFrame(() => {
      timeMachine.captureRoot();
    });

    return canvas;
  }
}
