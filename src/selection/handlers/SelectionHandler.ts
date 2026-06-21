import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import type { Camera } from '@/camera/Camera';
import { DEFAULT_SELECTION_SHORTCUTS } from '@/selection/selection-defaults';
import type { SelectionShortcuts } from '@/selection/selection-defaults';
import { DragHandler } from '@/selection/DragHandler';
import { GroupSelectionHandler } from '@/selection/GroupSelectionHandler';
import { SelectionOverlay } from '@/selection/SelectionOverlay';
import type { TransformHandler } from '@/selection/TransformHandler';
import { PathNodeHandler } from '@/selection/PathNodeHandler';
import type { CommandBus } from '@/commands/CommandBus';
import type { SelectionGesture } from '@/commands/types';
import { hitTestPoint } from '@/utils/hit-test';
import { pointToSegmentDist } from '@/utils/geometry-utils';
import {
  createSelectPickCommand,
  createSelectRectCommand,
} from '@/commands/factories/select-command-factory';
import {
  createRectOverlay,
  updateRectOverlay,
  hideRectOverlay,
  createLassoOverlay,
  updateLassoOverlay,
  hideLassoOverlay,
} from '@/utils/overlay-utils';
import type { RectOverlay, LassoOverlay } from '@/utils/overlay-utils';

export interface SelectionHandlerOptions {
  svg: SVGSVGElement;
  camera: Camera;
  overlayRoot: SVGGElement;
  selectionOverlay: SelectionOverlay;
  transformHandler: TransformHandler;
  state: SelectionState;
  getElements: () => AbstractGraphicElement[];
  grid: SpatialGrid;
  bus: CommandBus;
  isPanning?: () => boolean;
  shortcuts?: Partial<SelectionShortcuts>;
  getGroupIdForElement?: (elementId: string) => string | undefined;
  getArtboardRect?: () => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  onGroupSelect?: (ids: string[]) => void;
  onDragStart?: () => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
  onSetEditingPath?: (path: AbstractGraphicElement | null) => void;
  getEditingPath?: () => AbstractGraphicElement | null;
}

export class SelectionHandler {
  private readonly opts: SelectionHandlerOptions;
  private readonly dragHandler: DragHandler;
  private readonly groupHandler: GroupSelectionHandler;
  private readonly pathNodeHandler: PathNodeHandler;

  private shortcuts: SelectionShortcuts;
  private gesture: SelectionGesture = 'click';
  private ctrlHeld = false;
  private shiftOverride = false;

  private rectActive = false;
  private rectStartSvg = { x: 0, y: 0 };
  private rectStartWorld = { x: 0, y: 0 };
  private rectOverlay: RectOverlay = { element: null };

  private lassoActive = false;
  private lassoWorldPoints: { x: number; y: number }[] = [];
  private lassoOverlay: LassoOverlay = { element: null };

  public constructor(opts: SelectionHandlerOptions) {
    this.opts = opts;
    this.shortcuts = { ...DEFAULT_SELECTION_SHORTCUTS, ...opts.shortcuts };
    this.dragHandler = new DragHandler(
      opts.bus,
      opts.camera,
      opts.grid,
      opts.getElements,
      opts.getArtboardRect ?? (() => null),
    );

    const groupLookup = opts.getGroupIdForElement ?? (() => undefined);
    this.pathNodeHandler = new PathNodeHandler(opts.bus);
    this.pathNodeHandler.onNodeActivate = (cmdIdx) => {
      opts.selectionOverlay.activeCmdIdx = cmdIdx;
      const editingPath = opts.getEditingPath?.();
      if (editingPath) {
        opts.selectionOverlay.updatePathNodes(editingPath);
      }
    };
    this.groupHandler = new GroupSelectionHandler({
      getElements: opts.getElements,
      grid: opts.grid,
      lookupGroup: groupLookup,
      camera: opts.camera,
      bus: opts.bus,
      dragHandler: this.dragHandler,
      onGroupSelect: (ids) => opts.onGroupSelect?.(ids),
    });

    this.dragHandler.onDragStart = () => {
      opts.svg.style.cursor = 'grabbing';
      opts.onDragStart?.();
    };
    this.dragHandler.onDragMove = (dx: number, dy: number) => opts.onDragMove?.(dx, dy);
    this.dragHandler.onDragEnd = () => {
      opts.svg.style.cursor = '';
      opts.onDragEnd?.();
    };

    const origOnGroupSelect = opts.onGroupSelect;
    opts.onGroupSelect = (ids) => {
      this.groupHandler.setCurrentGroupIds(ids);
      origOnGroupSelect?.(ids);
    };

    this.bindEvents();
  }

  public setShortcuts(s: Partial<SelectionShortcuts>): void {
    this.shortcuts = { ...this.shortcuts, ...s };
  }

  public setGesture(g: SelectionGesture): void {
    this.gesture = g;
  }

  public getGesture(): SelectionGesture {
    return this.gesture;
  }

  public setSnapEnabled(enabled: boolean): void {
    this.dragHandler.setSnapEnabled(enabled);
  }

  public setSnapToArtboard(enabled: boolean): void {
    this.dragHandler.setSnapToArtboard(enabled);
  }

  public setAvoidCollisions(enabled: boolean): void {
    this.dragHandler.setAvoidCollisions(enabled);
  }

  private clientToSvg(e: MouseEvent): { x: number; y: number } {
    const svg = this.opts.svg;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return point.matrixTransform(ctm.inverse());
  }

  private screenToWorld(e: MouseEvent): { x: number; y: number } {
    const svgPt = this.clientToSvg(e);
    return this.opts.camera.screenToWorld({ x: svgPt.x, y: svgPt.y });
  }

  private tryElementHitTestAndDrag(wp: { x: number; y: number }): boolean {
    const all = this.opts.getElements();
    const hits = hitTestPoint(wp.x, wp.y, all, this.opts.grid);
    if (hits.length === 0) return false;

    const picked = hits[hits.length - 1];
    const selectedIds = new Set(this.opts.state.selected.map((s) => s.id));

    if (!selectedIds.has(picked.id)) {
      const cmd = createSelectPickCommand('element', wp, false);
      this.opts.bus.execute(cmd);
      selectedIds.clear();
      selectedIds.add(picked.id);
    }

    const selected = all.filter((e) => selectedIds.has(e.id));
    if (selected.length > 0) {
      this.dragHandler.startWithoutCheck(wp, selected);
      return true;
    }

    return false;
  }

  private tryHandleHitTest(svgPt: { x: number; y: number }): boolean {
    const hit = this.opts.selectionOverlay.hitTestHandle(svgPt.x, svgPt.y);
    if (!hit) return false;

    const { handle, element } = hit;
    const worldPt = this.opts.camera.screenToWorld(svgPt);

    return this.opts.transformHandler.tryStart(
      handle,
      new DOMRect(0, 0, 0, 0),
      element,
      worldPt,
      this.opts.state.selected,
    );
  }

  private bindEvents(): void {
    const rootSvg = this.opts.svg;
    const isGroup = () => this.opts.state.mode === 'group';
    const overlayRoot = this.opts.overlayRoot;
    const camera = this.opts.camera;

    let panning = false;
    let panStart = { x: 0, y: 0 };

    rootSvg.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;

      if (this.opts.isPanning?.()) {
        panning = true;
        panStart = { x: e.clientX, y: e.clientY };
        rootSvg.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      const svgPt = this.clientToSvg(e);
      const worldPt = this.screenToWorld(e);

      this.ctrlHeld = e.ctrlKey || e.metaKey;
      this.shiftOverride = e.shiftKey;
      const useRect = this.gesture === 'rect' || this.shiftOverride;

      // Если активен режим редактирования узлов пути
      const editingPath = this.opts.getEditingPath?.();
      if (editingPath) {
        // ШАГ 1: хит-тест ручек узлов пути через оверлей (как для ресайза)
        const handleHit = this.opts.selectionOverlay.hitTestPathNode(
          svgPt.x,
          svgPt.y,
        );
        if (handleHit) {
          const started = this.pathNodeHandler.startFromHandle(
            handleHit.elementId,
            handleHit.cmdIdx,
            handleHit.ptIdx,
            this.opts.getElements(),
            worldPt,
          );
          if (started) {
            e.preventDefault();
            return;
          }
        }

        // Клик не по ручке
        // Проверяем, кликнули ли по самому редактируемому пути
        const all = this.opts.getElements();
        const hits = hitTestPoint(worldPt.x, worldPt.y, all, this.opts.grid);
        const hitEditing = hits.some((h) => h.id === editingPath.id);
        if (!hitEditing) {
          this.opts.onSetEditingPath?.(null);
        } else {
          e.preventDefault();
          return;
        }
      }

      // ШАГ 2: хит-тест интерфейса (ручки ресайза)
      if (this.tryHandleHitTest(svgPt)) {
        e.preventDefault();
        return;
      }

      if (isGroup()) {
        const started = this.groupHandler.onMouseDown(
          worldPt,
          this.ctrlHeld,
          this.shiftOverride,
        );
        if (started) {
          e.preventDefault();
        } else if (useRect) {
          this.rectActive = true;
          this.rectStartSvg = { x: svgPt.x, y: svgPt.y };
          this.rectStartWorld = { x: worldPt.x, y: worldPt.y };
          this.rectOverlay = createRectOverlay(
            overlayRoot,
            camera,
            svgPt.x,
            svgPt.y,
          );
          if (!this.ctrlHeld) this.opts.state.clear();
        } else if (this.gesture === 'lasso') {
          this.lassoActive = true;
          this.lassoWorldPoints = [{ x: worldPt.x, y: worldPt.y }];
          this.lassoOverlay = createLassoOverlay(overlayRoot, camera);
          if (!this.ctrlHeld) this.opts.state.clear();
        }
        return;
      }

      // ШАГ 3: хит-тест элементов → попытка drag
      if (!this.ctrlHeld) {
        if (this.tryElementHitTestAndDrag(worldPt)) {
          e.preventDefault();
          return;
        }
      }

      if (useRect) {
        this.rectActive = true;
        this.rectStartSvg = { x: svgPt.x, y: svgPt.y };
        this.rectStartWorld = { x: worldPt.x, y: worldPt.y };
        this.rectOverlay = createRectOverlay(
          overlayRoot,
          camera,
          svgPt.x,
          svgPt.y,
        );
        if (!this.ctrlHeld) this.dispatchSelectClear();
      } else if (this.gesture === 'lasso') {
        this.lassoActive = true;
        this.lassoWorldPoints = [{ x: worldPt.x, y: worldPt.y }];
        this.lassoOverlay = createLassoOverlay(overlayRoot, camera);
        if (!this.ctrlHeld) this.dispatchSelectClear();
      } else {
        const cmd = createSelectPickCommand('element', worldPt, this.ctrlHeld);
        this.opts.bus.execute(cmd);
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (e.buttons === 0) return;

      if (panning) {
        const dx = (e.clientX - panStart.x) / this.opts.camera.zoom;
        const dy = (e.clientY - panStart.y) / this.opts.camera.zoom;
        this.opts.camera.pan(dx, dy);
        panStart = { x: e.clientX, y: e.clientY };
        return;
      }

      const svgPt = this.clientToSvg(e);
      const worldPt = this.screenToWorld(e);

      if (this.pathNodeHandler.isActive) {
        this.pathNodeHandler.move(worldPt);
        return;
      }

      if (this.opts.transformHandler.isActive) {
        this.opts.transformHandler.move(worldPt);
        return;
      }

      if (isGroup()) {
        if (this.dragHandler.isActive) this.dragHandler.move(worldPt);
        if (this.rectActive) this.updateRect(svgPt);
        if (this.lassoActive) {
          this.lassoWorldPoints.push({ x: worldPt.x, y: worldPt.y });
          updateLassoOverlay(this.lassoOverlay, this.lassoWorldPoints);
        }
        return;
      }

      if (this.dragHandler.isActive) {
        this.dragHandler.move(worldPt);
        return;
      }

      if (this.rectActive) this.updateRect(svgPt);

      if (this.lassoActive) {
        this.lassoWorldPoints.push({ x: worldPt.x, y: worldPt.y });
        updateLassoOverlay(this.lassoOverlay, this.lassoWorldPoints);
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button !== 0) return;

      if (panning) {
        panning = false;
        rootSvg.style.cursor = '';
        return;
      }

      const worldPt = this.screenToWorld(e);

      if (this.pathNodeHandler.isActive) {
        this.pathNodeHandler.end();
        return;
      }

      if (this.opts.transformHandler.isActive) {
        this.opts.transformHandler.end();
        return;
      }

      if (isGroup()) {
        if (this.dragHandler.isActive) this.dragHandler.end();
        else if (this.rectActive) {
          this.rectActive = false;
          hideRectOverlay(this.rectOverlay);
          this.groupHandler.onRectEnd(
            worldPt,
            this.ctrlHeld,
            this.rectStartWorld,
          );
        } else if (this.lassoActive) {
          this.lassoActive = false;
          hideLassoOverlay(this.lassoOverlay);
          this.groupHandler.onLassoEnd(this.lassoWorldPoints, this.ctrlHeld);
          this.lassoWorldPoints = [];
        }
        return;
      }

      if (this.dragHandler.isActive) {
        this.dragHandler.end();
        return;
      }

      if (this.rectActive) {
        this.rectActive = false;
        hideRectOverlay(this.rectOverlay);
        this.shiftOverride = false;
        if (this.isDragGesture(worldPt)) {
          this.dispatchSelectRect(worldPt);
        } else {
          const cmd = createSelectPickCommand(
            'element',
            worldPt,
            this.ctrlHeld,
          );
          this.opts.bus.execute(cmd);
        }
      }

      if (this.lassoActive) {
        this.lassoActive = false;
        hideLassoOverlay(this.lassoOverlay);
        if (this.lassoWorldPoints.length >= 3) {
          this.dispatchSelectLasso();
        } else {
          const cmd = createSelectPickCommand(
            'element',
            worldPt,
            this.ctrlHeld,
          );
          this.opts.bus.execute(cmd);
        }
        this.lassoWorldPoints = [];
      }
    });

    // Двойной клик — вход в режим редактирования узлов пути
    rootSvg.addEventListener('dblclick', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.defaultPrevented) return;
      const worldPt = this.screenToWorld(e);

      // Feature 1: Добавление точки на отрезок, если режим редактирования активен
      const editingPath = this.opts.getEditingPath?.();
      if (editingPath && editingPath.type === 'path') {
        const svgPt = this.clientToSvg(e);
        const handleHit = this.opts.selectionOverlay.hitTestPathNode(
          svgPt.x,
          svgPt.y,
        );
        if (handleHit) return;

        const pathEl =
          editingPath as any as import('@/shapes/elements/PathElement').PathElement;
        const cmds = pathEl.geometry.commands;

        // Инвертируем мировые координаты в локальные через матрицу элемента
        const inv = pathEl.transform.matrix.inverse();
        const localPt = inv.transformPoint({ x: worldPt.x, y: worldPt.y });

        let closestDist = Infinity;
        let closestCmdIdx = -1;
        let closestT = 0;
        let closestPrevEndX = 0;
        let closestPrevEndY = 0;

        for (let i = 1; i < cmds.length; i++) {
          const cmd = cmds[i];
          const cc = cmd.command.toUpperCase();
          if (cc === 'M') continue;

          const prev = cmds[i - 1];
          let ax: number, ay: number;
          if (
            prev.command.toUpperCase() === 'M' ||
            prev.command.toUpperCase() === 'L' ||
            prev.command.toUpperCase() === 'T'
          ) {
            ax = prev.args[0];
            ay = prev.args[1];
          } else if (
            prev.command.toUpperCase() === 'C' &&
            prev.args.length >= 6
          ) {
            ax = prev.args[4];
            ay = prev.args[5];
          } else if (
            prev.command.toUpperCase() === 'S' &&
            prev.args.length >= 4
          ) {
            ax = prev.args[2];
            ay = prev.args[3];
          } else if (
            prev.command.toUpperCase() === 'Q' &&
            prev.args.length >= 4
          ) {
            ax = prev.args[2];
            ay = prev.args[3];
          } else continue;

          if (cc === 'L' || cc === 'T') {
            const bx = cmd.args[0],
              by = cmd.args[1];
            const {
              dist,
              closestX: cx,
              closestY: cy,
            } = pointToSegmentDist(localPt.x, localPt.y, ax, ay, bx, by);
            if (dist < closestDist) {
              closestDist = dist;
              closestCmdIdx = i - 1;
              closestPrevEndX = ax;
              closestPrevEndY = ay;
              const dx = bx - ax,
                dy = by - ay;
              const lenSq = dx * dx + dy * dy;
              closestT =
                lenSq > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / lenSq : 0;
            }
          } else if (cc === 'C' && cmd.args.length >= 6) {
            const [c1x, c1y, c2x, c2y, ex, ey] = cmd.args;
            let bestT = 0;
            let bestDistC = Infinity;
            for (let s = 0; s <= 20; s++) {
              const t = s / 20;
              const mt = 1 - t;
              const px =
                mt * mt * mt * ax +
                3 * mt * mt * t * c1x +
                3 * mt * t * t * c2x +
                t * t * t * ex;
              const py =
                mt * mt * mt * ay +
                3 * mt * mt * t * c1y +
                3 * mt * t * t * c2y +
                t * t * t * ey;
              const d = Math.hypot(localPt.x - px, localPt.y - py);
              if (d < bestDistC) {
                bestDistC = d;
                bestT = t;
              }
            }
            if (bestDistC < closestDist) {
              closestDist = bestDistC;
              closestCmdIdx = i - 1;
              closestT = bestT;
              closestPrevEndX = ax;
              closestPrevEndY = ay;
            }
          } else if (cc === 'Q' && cmd.args.length >= 4) {
            const [c1x, c1y, ex, ey] = cmd.args;
            let bestT = 0;
            let bestDistQ = Infinity;
            for (let s = 0; s <= 20; s++) {
              const t = s / 20;
              const mt = 1 - t;
              const px = mt * mt * ax + 2 * mt * t * c1x + t * t * ex;
              const py = mt * mt * ay + 2 * mt * t * c1y + t * t * ey;
              const d = Math.hypot(localPt.x - px, localPt.y - py);
              if (d < bestDistQ) {
                bestDistQ = d;
                bestT = t;
              }
            }
            if (bestDistQ < closestDist) {
              closestDist = bestDistQ;
              closestCmdIdx = i - 1;
              closestT = bestT;
              closestPrevEndX = ax;
              closestPrevEndY = ay;
            }
          } else if (cc === 'S' && cmd.args.length >= 4) {
            const prevCmd = cmds[i - 1];
            const pc = prevCmd?.command.toUpperCase();
            let reflectX = ax,
              reflectY = ay;
            if (pc === 'C' && prevCmd.args.length >= 6) {
              reflectX = 2 * ax - prevCmd.args[2];
              reflectY = 2 * ay - prevCmd.args[3];
            }
            const [c2x, c2y, ex, ey] = cmd.args;
            let bestT = 0;
            let bestDistS = Infinity;
            for (let s = 0; s <= 20; s++) {
              const t = s / 20;
              const mt = 1 - t;
              const px =
                mt * mt * mt * ax +
                3 * mt * mt * t * reflectX +
                3 * mt * t * t * c2x +
                t * t * t * ex;
              const py =
                mt * mt * mt * ay +
                3 * mt * mt * t * reflectY +
                3 * mt * t * t * c2y +
                t * t * t * ey;
              const d = Math.hypot(localPt.x - px, localPt.y - py);
              if (d < bestDistS) {
                bestDistS = d;
                bestT = t;
              }
            }
            if (bestDistS < closestDist) {
              closestDist = bestDistS;
              closestCmdIdx = i - 1;
              closestT = bestT;
              closestPrevEndX = ax;
              closestPrevEndY = ay;
            }
          }
        }

        if (closestCmdIdx >= 0 && closestDist < 40) {
          // Вычисляем точку на кривой в локальных координатах
          const nextCmd = cmds[closestCmdIdx + 1];
          const ncc = nextCmd.command.toUpperCase();
          let localX = localPt.x,
            localY = localPt.y;

          if (
            (ncc === 'C' || ncc === 'S' || ncc === 'Q') &&
            closestT >= 0 &&
            closestT <= 1
          ) {
            const Ax = closestPrevEndX,
              Ay = closestPrevEndY;
            if (ncc === 'C' && nextCmd.args.length >= 6) {
              const [c1x, c1y, c2x, c2y, ex, ey] = nextCmd.args;
              const t = closestT,
                mt = 1 - t;
              localX =
                mt * mt * mt * Ax +
                3 * mt * mt * t * c1x +
                3 * mt * t * t * c2x +
                t * t * t * ex;
              localY =
                mt * mt * mt * Ay +
                3 * mt * mt * t * c1y +
                3 * mt * t * t * c2y +
                t * t * t * ey;
            } else if (ncc === 'Q' && nextCmd.args.length >= 4) {
              const [c1x, c1y, ex, ey] = nextCmd.args;
              const t = closestT,
                mt = 1 - t;
              localX = mt * mt * Ax + 2 * mt * t * c1x + t * t * ex;
              localY = mt * mt * Ay + 2 * mt * t * c1y + t * t * ey;
            } else if (ncc === 'S' && nextCmd.args.length >= 4) {
              const [c2x, c2y, ex, ey] = nextCmd.args;
              const t = closestT,
                mt = 1 - t;
              localX =
                mt * mt * mt * Ax +
                3 *
                  mt *
                  mt *
                  t *
                  (2 * Ax - (cmds[closestCmdIdx]?.args?.[2] ?? Ax)) +
                3 * mt * t * t * c2x +
                t * t * t * ex;
              localY =
                mt * mt * mt * Ay +
                3 *
                  mt *
                  mt *
                  t *
                  (2 * Ay - (cmds[closestCmdIdx]?.args?.[3] ?? Ay)) +
                3 * mt * t * t * c2y +
                t * t * t * ey;
            }
          }

          this.opts.bus.execute({
            type: 'PATH_ADD_NODE',
            options: {
              id: editingPath.id,
              cmdIdx: closestCmdIdx,
              x: localX,
              y: localY,
              t: closestT,
              prevEndX: closestPrevEndX,
              prevEndY: closestPrevEndY,
            },
          });
          e.preventDefault();
          return;
        }
      }

      const all = this.opts.getElements();
      const hits = hitTestPoint(worldPt.x, worldPt.y, all, this.opts.grid);
      if (hits.length > 0) {
        const picked = hits[hits.length - 1];
        if (
          picked.type === 'path' ||
          picked.type === 'polyline' ||
          picked.type === 'polygon'
        ) {
          this.opts.onSetEditingPath?.(picked);
        }
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === this.shortcuts.selectElement) this.gesture = 'click';
      else if (key === this.shortcuts.selectGroup) {
        this.gesture = 'click';
        this.opts.state.setMode('group');
      } else if (key === 'r') this.gesture = 'rect';
      else if (key === 'l') this.gesture = 'lasso';
      else if (key === 'v') {
        this.gesture = 'click';
        this.opts.state.setMode('element');
      } else if (e.key === 'Enter') {
        const selected = this.opts.state.selected;
        if (selected.length === 1 && selected[0].type === 'path') {
          this.opts.onSetEditingPath?.(selected[0]);
          e.preventDefault();
        }
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        this.pathNodeHandler.isActive
      ) {
        const editingPath = this.opts.getEditingPath?.();
        if (editingPath) {
          const act = this.pathNodeHandler.activation;
          if (act) {
            this.opts.bus.execute({
              type: 'PATH_REMOVE_NODE',
              options: { id: editingPath.id, cmdIdx: act.cmdIdx },
            });
            this.pathNodeHandler.abort();
            e.preventDefault();
          }
        }
      } else if (this.pathNodeHandler.isActive && key === 'c') {
        const editingPath = this.opts.getEditingPath?.();
        const act = this.pathNodeHandler.activation;
        if (editingPath && act) {
          this.opts.bus.execute({
            type: 'PATH_CHANGE_NODE_TYPE',
            options: { id: editingPath.id, cmdIdx: act.cmdIdx, newType: 'C' },
          });
          e.preventDefault();
        }
      } else if (this.pathNodeHandler.isActive && key === 'l') {
        const editingPath = this.opts.getEditingPath?.();
        const act = this.pathNodeHandler.activation;
        if (editingPath && act) {
          this.opts.bus.execute({
            type: 'PATH_CHANGE_NODE_TYPE',
            options: { id: editingPath.id, cmdIdx: act.cmdIdx, newType: 'L' },
          });
          e.preventDefault();
        }
      } else if (key === 'escape') {
        this.dispatchSelectClear();
        this.opts.onGroupSelect?.([]);
      }
    });
  }

  private updateRect(svgPt: { x: number; y: number }): void {
    const screenBBox = {
      x: Math.min(this.rectStartSvg.x, svgPt.x),
      y: Math.min(this.rectStartSvg.y, svgPt.y),
      w: Math.abs(svgPt.x - this.rectStartSvg.x),
      h: Math.abs(svgPt.y - this.rectStartSvg.y),
    };
    updateRectOverlay(
      this.rectOverlay,
      screenBBox,
      svgPt.x >= this.rectStartSvg.x,
      this.opts.camera,
    );
  }

  private dispatchSelectClear(): void {
    this.opts.state.clear();
  }

  private dispatchSelectRect(wp: { x: number; y: number }): void {
    this.opts.bus.execute(
      createSelectRectCommand(
        'element',
        {
          x: Math.min(this.rectStartWorld.x, wp.x),
          y: Math.min(this.rectStartWorld.y, wp.y),
          width: Math.abs(wp.x - this.rectStartWorld.x),
          height: Math.abs(wp.y - this.rectStartWorld.y),
        },
        this.ctrlHeld,
        wp.x >= this.rectStartWorld.x ? 'left-to-right' : 'right-to-left',
      ),
    );
  }

  private dispatchSelectLasso(): void {
    this.opts.bus.execute(
      createSelectRectCommand(
        'element',
        {
          x: Math.min(...this.lassoWorldPoints.map((p) => p.x)),
          y: Math.min(...this.lassoWorldPoints.map((p) => p.y)),
          width:
            Math.max(...this.lassoWorldPoints.map((p) => p.x)) -
            Math.min(...this.lassoWorldPoints.map((p) => p.x)),
          height:
            Math.max(...this.lassoWorldPoints.map((p) => p.y)) -
            Math.min(...this.lassoWorldPoints.map((p) => p.y)),
        },
        this.ctrlHeld,
        'left-to-right',
      ),
    );
  }

  private isDragGesture(wp: { x: number; y: number }): boolean {
    return (
      Math.abs(wp.x - this.rectStartWorld.x) >= 3 ||
      Math.abs(wp.y - this.rectStartWorld.y) >= 3
    );
  }
}
