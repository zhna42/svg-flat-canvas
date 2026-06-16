import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import type { Camera } from '@/camera/Camera';
import { DEFAULT_SELECTION_SHORTCUTS } from '@/selection/selection-defaults';
import type { SelectionShortcuts } from '@/selection/selection-defaults';
import { DragHandler } from '@/selection/DragHandler';
import { GroupSelectionHandler } from '@/selection/GroupSelectionHandler';
import type { CommandBus } from '@/commands/CommandBus';
import type { SelectionGesture } from '@/commands/types';
import {
  createSelectPickCommand,
  createSelectRectCommand,
} from '@/commands/factories/select-command-factory';
import { hitTestPoint } from '@/utils/hit-test';
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
  cameraGroup: SVGGElement;
  camera: Camera;
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
  private rectStart = { x: 0, y: 0 };
  private rectOverlay: RectOverlay = { element: null };

  private lassoActive = false;
  private lassoPoints: { x: number; y: number }[] = [];
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
      cameraGroup: opts.cameraGroup,
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

  private screenToWorld(e: MouseEvent): { x: number; y: number } {
    const svg = this.opts.svg;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPoint = point.matrixTransform(ctm.inverse());
    return {
      x: (svgPoint.x - this.opts.camera.x) / this.opts.camera.zoom,
      y: (svgPoint.y - this.opts.camera.y) / this.opts.camera.zoom,
    };
  }

  private tryDragFromHitTest(wp: { x: number; y: number }): boolean {
    const all = this.opts.getElements();
    const hits = hitTestPoint(
      wp.x,
      wp.y,
      all,
      this.opts.grid,
      this.opts.cameraGroup,
    );
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

  private bindEvents(): void {
    const svg = this.opts.svg;
    const win = window;
    const isGroup = () => this.opts.state.mode === 'group';

    svg.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (this.opts.isPanning?.()) return;
      this.ctrlHeld = e.ctrlKey || e.metaKey;
      this.shiftOverride = e.shiftKey;

      const wp = this.screenToWorld(e);
      const useRect = this.gesture === 'rect' || this.shiftOverride;

      if (isGroup()) {
        const started = this.groupHandler.onMouseDown(
          wp,
          this.ctrlHeld,
          this.shiftOverride,
        );
        if (started) {
          e.preventDefault();
        } else if (useRect) {
          this.rectActive = true;
          this.rectStart = { x: wp.x, y: wp.y };
          this.rectOverlay = createRectOverlay(
            this.opts.cameraGroup,
            this.opts.camera,
            wp.x,
            wp.y,
          );
          if (!this.ctrlHeld) this.opts.state.clear();
        } else if (this.gesture === 'lasso') {
          this.lassoActive = true;
          this.lassoPoints = [{ x: wp.x, y: wp.y }];
          this.lassoOverlay = createLassoOverlay(
            this.opts.cameraGroup,
            this.opts.camera,
          );
          if (!this.ctrlHeld) this.opts.state.clear();
        }
        return;
      }

      if (!this.ctrlHeld) {
        if (this.tryDragFromHitTest(wp)) {
          e.preventDefault();
          return;
        }
      }

      if (useRect) {
        this.rectActive = true;
        this.rectStart = { x: wp.x, y: wp.y };
        this.rectOverlay = createRectOverlay(
          this.opts.cameraGroup,
          this.opts.camera,
          wp.x,
          wp.y,
        );
        if (!this.ctrlHeld) this.opts.state.clear();
      } else if (this.gesture === 'lasso') {
        this.lassoActive = true;
        this.lassoPoints = [{ x: wp.x, y: wp.y }];
        this.lassoOverlay = createLassoOverlay(
          this.opts.cameraGroup,
          this.opts.camera,
        );
        if (!this.ctrlHeld) this.opts.state.clear();
      } else {
        const cmd = createSelectPickCommand('element', wp, this.ctrlHeld);
        this.opts.bus.execute(cmd);
      }
    });

    win.addEventListener('mousemove', (e: MouseEvent) => {
      if (e.buttons === 0) return;
      const wp = this.screenToWorld(e);

      if (isGroup()) {
        if (this.dragHandler.isActive) {
          this.dragHandler.move(wp);
        }
        if (this.rectActive) {
          const r = {
            x: Math.min(this.rectStart.x, wp.x),
            y: Math.min(this.rectStart.y, wp.y),
            w: Math.abs(wp.x - this.rectStart.x),
            h: Math.abs(wp.y - this.rectStart.y),
          };
          updateRectOverlay(
            this.rectOverlay,
            r,
            wp.x >= this.rectStart.x,
            this.opts.camera,
          );
        }
        if (this.lassoActive) {
          this.lassoPoints.push({ x: wp.x, y: wp.y });
          updateLassoOverlay(this.lassoOverlay, this.lassoPoints);
        }
        return;
      }

      if (this.dragHandler.isActive) {
        this.dragHandler.move(wp);
        return;
      }

      if (this.rectActive) {
        const r = {
          x: Math.min(this.rectStart.x, wp.x),
          y: Math.min(this.rectStart.y, wp.y),
          w: Math.abs(wp.x - this.rectStart.x),
          h: Math.abs(wp.y - this.rectStart.y),
        };
        updateRectOverlay(
          this.rectOverlay,
          r,
          wp.x >= this.rectStart.x,
          this.opts.camera,
        );
      }

      if (this.lassoActive) {
        this.lassoPoints.push({ x: wp.x, y: wp.y });
        updateLassoOverlay(this.lassoOverlay, this.lassoPoints);
      }
    });

    win.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button !== 0) return;
      const wp = this.screenToWorld(e);

      if (isGroup()) {
        if (this.dragHandler.isActive) {
          this.dragHandler.end();
        } else if (this.rectActive) {
          this.rectActive = false;
          hideRectOverlay(this.rectOverlay);
          this.groupHandler.onRectEnd(wp, this.ctrlHeld, this.rectStart);
        } else if (this.lassoActive) {
          this.lassoActive = false;
          hideLassoOverlay(this.lassoOverlay);
          this.groupHandler.onLassoEnd(this.lassoPoints, this.ctrlHeld);
          this.lassoPoints = [];
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
        const dx = Math.abs(wp.x - this.rectStart.x);
        const dy = Math.abs(wp.y - this.rectStart.y);
        const wasDrag = dx >= 3 || dy >= 3;
        this.shiftOverride = false;
        if (wasDrag) {
          const cmd = createSelectRectCommand(
            'element',
            {
              x: Math.min(this.rectStart.x, wp.x),
              y: Math.min(this.rectStart.y, wp.y),
              width: Math.abs(wp.x - this.rectStart.x),
              height: Math.abs(wp.y - this.rectStart.y),
            },
            this.ctrlHeld,
            wp.x >= this.rectStart.x ? 'left-to-right' : 'right-to-left',
          );
          this.opts.bus.execute(cmd);
        } else {
          const cmd = createSelectPickCommand('element', wp, this.ctrlHeld);
          this.opts.bus.execute(cmd);
        }
      }

      if (this.lassoActive) {
        this.lassoActive = false;
        hideLassoOverlay(this.lassoOverlay);
        if (this.lassoPoints.length >= 3) {
          const cmd = createSelectRectCommand(
            'element',
            {
              x: Math.min(...this.lassoPoints.map((p) => p.x)),
              y: Math.min(...this.lassoPoints.map((p) => p.y)),
              width:
                Math.max(...this.lassoPoints.map((p) => p.x)) -
                Math.min(...this.lassoPoints.map((p) => p.x)),
              height:
                Math.max(...this.lassoPoints.map((p) => p.y)) -
                Math.min(...this.lassoPoints.map((p) => p.y)),
            },
            this.ctrlHeld,
            'left-to-right',
          );
          this.opts.bus.execute(cmd);
        } else {
          const cmd = createSelectPickCommand('element', wp, this.ctrlHeld);
          this.opts.bus.execute(cmd);
        }
        this.lassoPoints = [];
      }
    });

    win.addEventListener('keydown', (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === this.shortcuts.selectElement) {
        this.gesture = 'click';
      } else if (key === this.shortcuts.selectGroup) {
        this.gesture = 'click';
        this.opts.state.setMode('group');
      }
      if (key === 'r') {
        this.gesture = 'rect';
      }
      if (key === 'l') {
        this.gesture = 'lasso';
      }
      if (key === 'v') {
        this.gesture = 'click';
        this.opts.state.setMode('element');
      }
      if (key === 'escape') {
        this.opts.state.clear();
        this.opts.onGroupSelect?.([]);
      }
    });
  }
}
