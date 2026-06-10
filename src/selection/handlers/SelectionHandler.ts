import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import type { SelectionShortcuts } from '@/selection/selection-defaults';
import type { Camera } from '@/camera/Camera';
import { DEFAULT_SELECTION_SHORTCUTS } from '@/selection/selection-defaults';
import { ClickHandler } from './ClickHandler';
import { RectHandler } from './RectHandler';
import { LassoHandler } from './LassoHandler';

export type SelectionGesture = 'click' | 'rect' | 'lasso';

export class SelectionHandler {
  private readonly state: SelectionState;
  private readonly clickHandler: ClickHandler;
  private readonly rectHandler: RectHandler;
  private readonly lassoHandler: LassoHandler;
  private readonly cameraGroup: SVGGElement;
  private readonly svg: SVGSVGElement;
  private readonly camera: Camera;

  private shortcuts: SelectionShortcuts;
  private gesture: SelectionGesture = 'click';
  private ctrlHeld = false;
  private shiftOverride = false;
  private cursorOverlay: SVGRectElement | null = null;
  private lassoOverlay: SVGPolylineElement | null = null;
  public isPanning: (() => boolean) | null = null;

  public constructor(
    svg: SVGSVGElement,
    cameraGroup: SVGGElement,
    camera: Camera,
    state: SelectionState,
    getElements: () => SvgElement[],
    grid: SpatialGrid,
    isPanning?: () => boolean,
    shortcuts?: Partial<SelectionShortcuts>,
  ) {
    this.svg = svg;
    this.cameraGroup = cameraGroup;
    this.camera = camera;
    this.state = state;
    this.isPanning = isPanning ?? null;
    this.shortcuts = { ...DEFAULT_SELECTION_SHORTCUTS, ...shortcuts };
    this.clickHandler = new ClickHandler(state, getElements, grid);
    this.rectHandler = new RectHandler(state, getElements, grid);
    this.lassoHandler = new LassoHandler(state, getElements, grid);
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
    const svg = this.svg;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPoint = point.matrixTransform(ctm.inverse());
    return {
      x: (svgPoint.x - this.camera.x) / this.camera.zoom,
      y: (svgPoint.y - this.camera.y) / this.camera.zoom,
    };
  }

  private bindEvents(): void {
    const svg = this.svg;
    const win = window;

    svg.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (this.isPanning?.()) return;
      this.ctrlHeld = e.ctrlKey || e.metaKey;
      this.shiftOverride = e.shiftKey;

      const wp = this.screenToWorld(e);
      const useRect = this.gesture === 'rect' || this.shiftOverride;

      if (useRect) {
        this.rectHandler.start(wp);
        this.showRectOverlay(wp.x, wp.y);
      } else if (this.gesture === 'lasso') {
        this.lassoHandler.start(wp.x, wp.y);
        this.showLassoOverlay();
      } else {
        this.clickHandler.handle(wp.x, wp.y, this.ctrlHeld);
      }
    });

    win.addEventListener('mousemove', (e: MouseEvent) => {
      if (e.buttons === 0) return;

      if (this.rectHandler.isActive) {
        const wp = this.screenToWorld(e);
        const r = this.rectHandler.move(wp);
        if (r) this.updateRectOverlay(r);
      }
      if (this.lassoHandler.isActive) {
        const wp = this.screenToWorld(e);
        this.lassoHandler.move(wp.x, wp.y);
        this.updateLassoOverlay();
      }
    });

    win.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button !== 0) return;

      const wp = this.screenToWorld(e);

      if (this.rectHandler.isActive) {
        this.rectHandler.end(wp, this.ctrlHeld);
        this.hideRectOverlay();
        this.shiftOverride = false;
      }
      if (this.lassoHandler.isActive) {
        this.lassoHandler.end(wp.x, wp.y, this.ctrlHeld);
        this.hideLassoOverlay();
      }
    });

    win.addEventListener('keydown', (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === this.shortcuts.selectElement) {
        this.gesture = 'click';
      } else if (key === this.shortcuts.selectGroup) {
        this.gesture = 'click';
        this.state.setMode('group');
      }
      if (key === 'r') {
        this.gesture = 'rect';
        console.log('[select] gesture = rect');
      }
      if (key === 'l') {
        this.gesture = 'lasso';
        console.log('[select] gesture = lasso');
      }
      if (key === 'v') {
        this.gesture = 'click';
        this.state.setMode('element');
        console.log('[select] gesture = click, mode = element');
      }
    });
  }

  private showRectOverlay(x: number, y: number): void {
    const ns = 'http://www.w3.org/2000/svg';
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('fill', 'rgba(66, 133, 244, 0.12)');
    rect.setAttribute('stroke', '#4285f4');
    rect.setAttribute('stroke-width', String(1 / this.camera.zoom));
    rect.setAttribute('pointer-events', 'none');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', '0');
    rect.setAttribute('height', '0');
    this.cameraGroup.appendChild(rect);
    this.cursorOverlay = rect;
  }

  private updateRectOverlay(r: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): void {
    if (!this.cursorOverlay) return;
    this.cursorOverlay.setAttribute('x', String(r.x));
    this.cursorOverlay.setAttribute('y', String(r.y));
    this.cursorOverlay.setAttribute('width', String(r.w));
    this.cursorOverlay.setAttribute('height', String(r.h));
  }

  private hideRectOverlay(): void {
    if (this.cursorOverlay) {
      this.cursorOverlay.remove();
      this.cursorOverlay = null;
    }
  }

  private showLassoOverlay(): void {
    const ns = 'http://www.w3.org/2000/svg';
    const poly = document.createElementNS(ns, 'polyline');
    poly.setAttribute('fill', 'rgba(255, 165, 0, 0.1)');
    poly.setAttribute('stroke', '#ff8c00');
    poly.setAttribute('stroke-width', String(1.5 / this.camera.zoom));
    poly.setAttribute(
      'stroke-dasharray',
      String(3 / this.camera.zoom) + ' ' + String(2 / this.camera.zoom),
    );
    poly.setAttribute('pointer-events', 'none');
    poly.setAttribute('stroke-linejoin', 'round');
    this.cameraGroup.appendChild(poly);
    this.lassoOverlay = poly;
  }

  private updateLassoOverlay(): void {
    if (!this.lassoOverlay) return;
    const pts = this.lassoHandler.currentPoints;
    const str = pts.map((p) => `${p.x},${p.y}`).join(' ');
    this.lassoOverlay.setAttribute('points', str);
  }

  private hideLassoOverlay(): void {
    if (this.lassoOverlay) {
      this.lassoOverlay.remove();
      this.lassoOverlay = null;
    }
  }
}
