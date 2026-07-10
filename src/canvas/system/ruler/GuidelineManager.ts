import type { Camera } from '@/canvas/Camera';
import type { EventBus } from '@/core/EventBus';
import type { GuidelineData } from '@/types';
import { Guideline } from './Guideline';
import { getSvgViewportBounds, getRulerSvgSize } from './RulerBuilder';

const GUIDELINE_HIT_TOLERANCE = 6;
const MIN_DRAG_DIST = 3;

interface DragState {
  type: 'ruler' | 'guideline';
  orientation: 'v' | 'h';
  startScreenX: number;
  startScreenY: number;
  guid?: string;
  created: boolean;
}

export class GuidelineManager {
  private guidelines = new Map<string, Guideline>();

  private guidelinesVisibleV = true;
  private guidelinesVisibleH = true;
  private rulersVisible = true;

  private dragging: DragState | null = null;
  private activeGuideline: string | null = null;

  constructor(
    private readonly camera: Camera,
    private readonly events: EventBus,
    private readonly svg: SVGSVGElement,
    private readonly registerDirty: (instance: any) => void,
    private readonly removeDom: (id: string) => void,
  ) {
    this.bindPointerEvents();
  }

  public get isDragging(): boolean {
    return this.dragging !== null;
  }

  public setRulersVisible(v: boolean): void {
    this.rulersVisible = v;
    this.events.emit('RULER_VISIBILITY_CHANGED', { visible: v });
  }

  // ── public API ──

  public addGuideline(orientation: 'v' | 'h', position: number): string {
    const id = `guideline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const g = new Guideline(id, orientation, position, this.registerDirty);
    g.setVisible(this.isOrientationVisible(orientation));
    this.guidelines.set(id, g);
    this.syncOne(g);
    this.events.emit('RULER_GUIDELINE_ADD', { id, orientation, position });
    return id;
  }

  public removeGuideline(id: string): void {
    const g = this.guidelines.get(id);
    if (!g) return;
    this.guidelines.delete(id);
    this.removeDom(id);
    this.events.emit('RULER_GUIDELINE_REMOVE', { id });
  }

  public getGuidelines(): GuidelineData[] {
    return Array.from(this.guidelines.entries()).map(([id, g]) => ({
      id,
      orientation: g.orientation,
      position: g.position,
    }));
  }

  public setGuidelinesVisible(orientation: 'v' | 'h', visible: boolean): void {
    if (orientation === 'v') this.guidelinesVisibleV = visible;
    else this.guidelinesVisibleH = visible;
    for (const g of this.guidelines.values()) {
      if (g.orientation === orientation) g.setVisible(visible);
    }
    this.events.emit('RULER_GUIDELINES_VISIBILITY_CHANGED', {
      orientation,
      visible,
    });
  }

  public getGuidelinesVisible(orientation: 'v' | 'h'): boolean {
    return orientation === 'v'
      ? this.guidelinesVisibleV
      : this.guidelinesVisibleH;
  }

  public onCameraChange(): void {
    const bounds = getSvgViewportBounds(this.svg);
    for (const g of this.guidelines.values()) {
      g.sync(this.camera, bounds.w, bounds.h);
    }
  }

  public destroy(): void {
    for (const id of Array.from(this.guidelines.keys())) {
      this.removeGuideline(id);
    }
  }

  // ── internal ──

  private isOrientationVisible(orientation: 'v' | 'h'): boolean {
    return orientation === 'v'
      ? this.guidelinesVisibleV
      : this.guidelinesVisibleH;
  }

  private syncOne(g: Guideline): void {
    const bounds = getSvgViewportBounds(this.svg);
    g.sync(this.camera, bounds.w, bounds.h);
  }

  private hitTestGuideline(sx: number, sy: number): string | null {
    for (const [id, g] of this.guidelines) {
      if (g.hitTest(sx, sy, GUIDELINE_HIT_TOLERANCE)) return id;
    }
    return null;
  }

  private clientToSvg(e: MouseEvent): { x: number; y: number } | null {
    const point = this.svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    const svgPt = point.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  // ── pointer events ──

  private bindPointerEvents(): void {
    this.svg.addEventListener('mousedown', this.onMouseDown, true);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.svg.addEventListener('dblclick', this.onDblClick, true);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    const svgPt = this.clientToSvg(e);
    if (!svgPt) return;

    const hit = this.hitTestGuideline(svgPt.x, svgPt.y);
    if (hit) {
      this.activeGuideline = hit;
      const g = this.guidelines.get(hit);
      if (g) {
        this.dragging = {
          type: 'guideline',
          orientation: g.orientation,
          startScreenX: svgPt.x,
          startScreenY: svgPt.y,
          guid: hit,
          created: true,
        };
        e.preventDefault();
        return;
      }
    } else {
      this.activeGuideline = null;
    }

    if (!this.rulersVisible) return;

    const { rsV, rsH } = getRulerSvgSize(this.svg);

    if (svgPt.x <= rsV && svgPt.y > rsH) {
      this.dragging = {
        type: 'ruler',
        orientation: 'v',
        startScreenX: svgPt.x,
        startScreenY: svgPt.y,
        created: false,
      };
      e.preventDefault();
      return;
    }
    if (svgPt.y <= rsH && svgPt.x > rsV) {
      this.dragging = {
        type: 'ruler',
        orientation: 'h',
        startScreenX: svgPt.x,
        startScreenY: svgPt.y,
        created: false,
      };
      e.preventDefault();
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    const svgPt = this.clientToSvg(e);
    if (!svgPt) return;

    if (this.dragging.type === 'ruler') {
      const dx = svgPt.x - this.dragging.startScreenX;
      const dy = svgPt.y - this.dragging.startScreenY;
      const dist = Math.abs(this.dragging.orientation === 'v' ? dx : dy);

      if (!this.dragging.created && dist > MIN_DRAG_DIST) {
        const wp = this.camera.screenToWorld(svgPt);
        const pos = this.dragging.orientation === 'v' ? wp.x : wp.y;
        this.dragging.guid = this.addGuideline(this.dragging.orientation, pos);
        this.dragging.created = true;
      }
      if (this.dragging.created && this.dragging.guid) {
        this.moveGuidelineTo(this.dragging.guid, svgPt);
      }
      return;
    }

    if (this.dragging.type === 'guideline' && this.dragging.guid) {
      this.moveGuidelineTo(this.dragging.guid, svgPt);
    }
  };

  private onMouseUp = (): void => {
    if (!this.dragging) return;
    if (this.dragging.guid) {
      const g = this.guidelines.get(this.dragging.guid);
      if (g) {
        this.events.emit('RULER_GUIDELINE_MOVE', {
          id: this.dragging.guid,
          orientation: g.orientation,
          position: g.position,
        });
      }
    }
    this.dragging = null;
  };

  private moveGuidelineTo(id: string, svgPt: { x: number; y: number }): void {
    const g = this.guidelines.get(id);
    if (!g) return;
    const wp = this.camera.screenToWorld(svgPt);
    g.setPosition(g.orientation === 'v' ? wp.x : wp.y);
    this.syncOne(g);
  }

  private onDblClick = (e: MouseEvent): void => {
    const svgPt = this.clientToSvg(e);
    if (!svgPt) return;
    const hit = this.hitTestGuideline(svgPt.x, svgPt.y);
    if (hit) {
      this.removeGuideline(hit);
      this.activeGuideline = null;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Delete' || e.code === 'Backspace') {
      if (this.activeGuideline && !this.dragging) {
        this.removeGuideline(this.activeGuideline);
        this.activeGuideline = null;
      }
    }
  };
}
