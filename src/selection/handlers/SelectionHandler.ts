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
import type { CommandBus } from '@/commands/CommandBus';
import type { SelectionGesture } from '@/commands/types';
import { hitTestPoint } from '@/utils/hit-test';
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
  onGroupSelect?: (ids: string[]) => void;
  onDragStart?: () => void;
  onDragMove?: () => void;
  onDragEnd?: () => void;
}

export class SelectionHandler {
  private readonly opts: SelectionHandlerOptions;
  private readonly dragHandler: DragHandler;
  private readonly groupHandler: GroupSelectionHandler;

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
    this.dragHandler = new DragHandler(opts.bus);

    const groupLookup = opts.getGroupIdForElement ?? (() => undefined);
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
    this.dragHandler.onDragMove = () => opts.onDragMove?.();
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
    console.log('[DEBUG] tryHandleHitTest', {
      svgPt,
      found: !!hit,
      handle: hit?.handle,
      elementId: hit?.element?.id,
    });
    if (!hit) return false;

    const { handle, element, screenBBox } = hit;
    const worldPt = this.opts.camera.screenToWorld(svgPt);

    const started = this.opts.transformHandler.tryStart(
      handle,
      new DOMRect(
        screenBBox.x,
        screenBBox.y,
        screenBBox.width,
        screenBBox.height,
      ),
      element,
      worldPt,
      this.opts.state.selected,
    );
    console.log(
      '[DEBUG] transformHandler started:',
      started,
      'active after:',
      this.opts.transformHandler.isActive,
    );
    return started;
  }

  private bindEvents(): void {
    const rootSvg = this.opts.svg;
    const isGroup = () => this.opts.state.mode === 'group';
    const overlayRoot = this.opts.overlayRoot;
    const camera = this.opts.camera;

    rootSvg.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (this.opts.isPanning?.()) return;

      const svgPt = this.clientToSvg(e);
      const worldPt = this.screenToWorld(e);

      this.ctrlHeld = e.ctrlKey || e.metaKey;
      this.shiftOverride = e.shiftKey;
      const useRect = this.gesture === 'rect' || this.shiftOverride;

      // ШАГ 2: хит-тест интерфейса (ручки ресайза)
      console.log(
        '[DEBUG] before handleHitTest, transformHandler.isActive:',
        this.opts.transformHandler.isActive,
      );
      if (this.tryHandleHitTest(svgPt)) {
        console.log('[DEBUG] handle hit, returning');
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
      const svgPt = this.clientToSvg(e);
      const worldPt = this.screenToWorld(e);

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
      const worldPt = this.screenToWorld(e);

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
