import type { Camera } from '@/camera/Camera';
import type { EventBus } from '@/core/EventBus';
import type { Renderable } from '@/renderer/RenderQueue';
import { getRenderQueue } from '@/utils/render-queue-utils';
import { SVG_NS } from '@/constants';

const RULER_SIZE = 24;
const RULER_BG = '#fff';
const RULER_BORDER = '#888';
const RULER_TEXT_COLOR = '#555';
const RULER_TICK_COLOR = '#888';
const GUIDELINE_COLOR = '#ff4444';
const GUIDELINE_WIDTH = 1;
const GUIDELINE_HIT_TOLERANCE = 6;
const MIN_DRAG_DIST = 3;
const PX_PER_MM = 3.779527559055118;

export interface GuidelineData {
  id: string;
  orientation: 'v' | 'h';
  position: number;
}

export type GuidelineEvents = {
  RULER_VISIBILITY_CHANGED: { visible: boolean };
  RULER_GUIDELINE_ADD: { id: string; orientation: 'v' | 'h'; position: number };
  RULER_GUIDELINE_REMOVE: { id: string };
  RULER_GUIDELINE_MOVE: {
    id: string;
    orientation: 'v' | 'h';
    position: number;
  };
  RULER_GUIDELINES_VISIBILITY_CHANGED: {
    orientation: 'v' | 'h';
    visible: boolean;
  };
};

export class RulerManager implements Renderable {
  public readonly root: SVGGElement;
  private rulersGroup: SVGGElement;
  private guidelinesGroup: SVGGElement;

  private rulersVisible = true;
  private guidelinesVisibleV = true;
  private guidelinesVisibleH = true;

  private guidelines = new Map<
    string,
    { orientation: 'v' | 'h'; position: number; line: SVGLineElement }
  >();

  private camera: Camera;
  private events: EventBus;
  private svg: SVGSVGElement;
  private viewW: number;
  private viewH: number;

  private _dirty = false;

  private dragging: {
    type: 'ruler' | 'guideline';
    orientation: 'v' | 'h';
    startScreenX: number;
    startScreenY: number;
    startWorldPos: number;
    guid?: string;
    previewLine?: SVGLineElement;
  } | null = null;

  private activeGuideline: string | null = null;

  public get isDragging(): boolean {
    return this.dragging !== null;
  }

  constructor(
    camera: Camera,
    events: EventBus,
    svg: SVGSVGElement,
    viewW: number,
    viewH: number,
  ) {
    this.camera = camera;
    this.events = events;
    this.svg = svg;
    this.viewW = viewW;
    this.viewH = viewH;

    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('pointer-events', 'none');

    this.guidelinesGroup = document.createElementNS(SVG_NS, 'g');
    this.root.appendChild(this.guidelinesGroup);

    this.rulersGroup = document.createElementNS(SVG_NS, 'g');
    this.root.appendChild(this.rulersGroup);

    this.buildRulers();
    this._dirty = true;
    getRenderQueue()?.addDrainable('ruler', this);

    this.bindPointerEvents();
  }

  public get dirty(): boolean {
    return this._dirty;
  }

  public markClean(): void {
    this._dirty = false;
  }

  // ── public API ──

  public onCameraChange(): void {
    this._dirty = true;
    getRenderQueue()?.addDrainable('ruler', this);
  }

  public setRulersVisible(v: boolean): void {
    this.rulersVisible = v;
    this.rulersGroup.setAttribute('visibility', v ? 'visible' : 'hidden');
    this.events.emit('RULER_VISIBILITY_CHANGED', { visible: v });
  }

  public getRulersVisible(): boolean {
    return this.rulersVisible;
  }

  public addGuideline(orientation: 'v' | 'h', position: number): string {
    const id = `guideline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const line = this.createGuidelineElement(orientation, position);
    this.guidelinesGroup.appendChild(line);
    this.guidelines.set(id, { orientation, position, line });
    this.events.emit('RULER_GUIDELINE_ADD', { id, orientation, position });
    return id;
  }

  public removeGuideline(id: string): void {
    const g = this.guidelines.get(id);
    if (!g) return;
    g.line.remove();
    this.guidelines.delete(id);
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
    this.applyGuidelineVisibility();
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

  // ── render ──

  public flushToDOM(): void {
    if (this._dirty) {
      this.updateRulers();
      this.updateGuidelinePositions();
    }
    this.markClean();
  }

  private updateRulers(): void {
    const z = this.camera.zoom;
    const targetPx = 7 / z;
    const targetMm = targetPx / PX_PER_MM;
    const mmStep = this.niceStep(targetMm);
    const step = mmStep * PX_PER_MM;
    const panX = this.camera.x;
    const panY = this.camera.y;
    const bounds = this.getViewportBounds();
    const svgW = bounds.w;
    const svgH = bounds.h;
    const rs = RULER_SIZE;
    const lineW = 0.5;

    if (svgW < rs || svgH < rs) {
      this.rulersGroup.innerHTML = '';
      return;
    }

    let h = '';

    // corner
    h += `<rect x="0" y="0" width="${rs}" height="${rs}" fill="${RULER_BG}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;
    {
      const originSx = panX;
      const originSy = panY;
      if (originSx < rs && originSy < rs) {
        h += `<text x="${rs - 2}" y="${rs - 4}" fill="${RULER_TEXT_COLOR}" font-size="8" font-family="system-ui, sans-serif" text-anchor="end">0</text>`;
      }
    }

    // horizontal ruler background + border
    h += `<rect x="${rs}" y="0" width="${svgW - rs}" height="${rs}" fill="${RULER_BG}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;
    h += `<line x1="${rs}" y1="${rs}" x2="${svgW}" y2="${rs}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;

    // vertical ruler background + border
    h += `<rect x="0" y="${rs}" width="${rs}" height="${svgH - rs}" fill="${RULER_BG}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;
    h += `<line x1="${rs}" y1="${rs}" x2="${rs}" y2="${svgH}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;

    // horizontal ticks
    const stepPx = step * z;
    const startIdxH = Math.floor(-panX / stepPx);
    for (let i = startIdxH; ; i++) {
      const w = i * step;
      const sx = w * z + panX;
      if (sx >= svgW) break;
      if (sx < rs) continue;

      const mmVal = w / PX_PER_MM;
      const tickType = this.getTickType(mmVal, mmStep);
      const len =
        tickType === 'major'
          ? rs - 3
          : tickType === 'medium'
            ? rs * 0.55
            : rs * 0.3;

      h += `<line x1="${sx}" y1="${rs - len}" x2="${sx}" y2="${rs}" stroke="${RULER_TICK_COLOR}" stroke-width="${lineW}"/>`;
      if (tickType === 'major') {
        h += `<text x="${sx + 2}" y="${rs - 4}" fill="${RULER_TEXT_COLOR}" font-size="9" font-family="system-ui, sans-serif">${this.formatMmLabel(mmVal, mmStep)}</text>`;
      }
    }

    // vertical ticks
    const startIdxV = Math.floor(-panY / stepPx);
    for (let i = startIdxV; ; i++) {
      const w = i * step;
      const sy = w * z + panY;
      if (sy >= svgH) break;
      if (sy < rs) continue;

      const mmVal = w / PX_PER_MM;
      const tickType = this.getTickType(mmVal, mmStep);
      const len =
        tickType === 'major'
          ? rs - 3
          : tickType === 'medium'
            ? rs * 0.55
            : rs * 0.3;

      h += `<line x1="${rs - len}" y1="${sy}" x2="${rs}" y2="${sy}" stroke="${RULER_TICK_COLOR}" stroke-width="${lineW}"/>`;
      if (tickType === 'major') {
        h += `<text x="${rs - 2}" y="${sy + 2}" fill="${RULER_TEXT_COLOR}" font-size="9" font-family="system-ui, sans-serif" text-anchor="end" dominant-baseline="hanging">${this.formatMmLabel(mmVal, mmStep)}</text>`;
      }
    }

    this.rulersGroup.innerHTML = h;
  }

  private getTickType(
    mmVal: number,
    mmStep: number,
  ): 'minor' | 'medium' | 'major' {
    const r10 = Math.abs(mmVal % (mmStep * 10));
    if (r10 < 0.001 || Math.abs(r10 - mmStep * 10) < 0.001) return 'major';
    const r5 = Math.abs(mmVal % (mmStep * 5));
    if (r5 < 0.001 || Math.abs(r5 - mmStep * 5) < 0.001) return 'medium';
    return 'minor';
  }

  private niceStep(target: number): number {
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    for (const s of steps) {
      if (s >= target) return s;
    }
    return 1000;
  }

  private formatMmLabel(mmVal: number, mmStep: number): string {
    if (mmStep >= 1) return String(Math.round(mmVal));
    return parseFloat(mmVal.toFixed(1)).toString();
  }

  private getViewportBounds(): { w: number; h: number } {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { w: this.viewW, h: this.viewH };
    const rect = this.svg.getBoundingClientRect();
    const inv = ctm.inverse();
    const p0 = this.svg.createSVGPoint();
    p0.x = rect.left;
    p0.y = rect.top;
    const p1 = this.svg.createSVGPoint();
    p1.x = rect.left + rect.width;
    p1.y = rect.top + rect.height;
    const v0 = p0.matrixTransform(inv);
    const v1 = p1.matrixTransform(inv);
    return { w: v1.x - v0.x, h: v1.y - v0.y };
  }

  private updateGuidelinePositions(): void {
    const bounds = this.getViewportBounds();
    for (const g of this.guidelines.values()) {
      const screen = this.camera.worldToScreen({
        x: g.orientation === 'v' ? g.position : 0,
        y: g.orientation === 'h' ? g.position : 0,
      });
      if (g.orientation === 'v') {
        g.line.setAttribute('x1', String(screen.x));
        g.line.setAttribute('x2', String(screen.x));
        g.line.setAttribute('y1', '0');
        g.line.setAttribute('y2', String(bounds.h));
      } else {
        g.line.setAttribute('y1', String(screen.y));
        g.line.setAttribute('y2', String(screen.y));
        g.line.setAttribute('x1', '0');
        g.line.setAttribute('x2', String(bounds.w));
      }
    }
    this.applyGuidelineVisibility();
  }

  private applyGuidelineVisibility(): void {
    for (const g of this.guidelines.values()) {
      const visible =
        (g.orientation === 'v' && this.guidelinesVisibleV) ||
        (g.orientation === 'h' && this.guidelinesVisibleH);
      g.line.setAttribute('visibility', visible ? 'visible' : 'hidden');
    }
  }

  private createGuidelineElement(
    orientation: 'v' | 'h',
    position: number,
  ): SVGLineElement {
    const line = document.createElementNS(SVG_NS, 'line');
    const screen = this.camera.worldToScreen({
      x: orientation === 'v' ? position : 0,
      y: orientation === 'h' ? position : 0,
    });
    line.setAttribute('stroke', GUIDELINE_COLOR);
    line.setAttribute('stroke-width', String(GUIDELINE_WIDTH));
    line.setAttribute('stroke-dasharray', '4 3');
    line.setAttribute('pointer-events', 'stroke');
    const bounds = this.getViewportBounds();
    if (orientation === 'v') {
      line.setAttribute('x1', String(screen.x));
      line.setAttribute('x2', String(screen.x));
      line.setAttribute('y1', '0');
      line.setAttribute('y2', String(bounds.h));
    } else {
      line.setAttribute('y1', String(screen.y));
      line.setAttribute('y2', String(screen.y));
      line.setAttribute('x1', '0');
      line.setAttribute('x2', String(bounds.w));
    }
    return line;
  }

  private buildRulers(): void {
    this.rulersGroup.setAttribute(
      'visibility',
      this.rulersVisible ? 'visible' : 'hidden',
    );
    this.updateRulers();
  }

  // ── pointer events ──

  private bindPointerEvents(): void {
    this.svg.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        const svgPt = this.clientToSvg(e);
        if (!svgPt) return;

        // Check guideline hit
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
              startWorldPos: g.position,
              guid: hit,
            };
            e.preventDefault();
            return;
          }
        } else {
          this.activeGuideline = null;
        }

        // Check ruler drag start
        if (this.rulersVisible) {
          if (svgPt.x <= RULER_SIZE && svgPt.y > RULER_SIZE) {
            const wp = this.camera.screenToWorld(svgPt);
            this.dragging = {
              type: 'ruler',
              orientation: 'v',
              startScreenX: svgPt.x,
              startScreenY: svgPt.y,
              startWorldPos: wp.x,
            };
            e.preventDefault();
            return;
          }
          if (svgPt.y <= RULER_SIZE && svgPt.x > RULER_SIZE) {
            const wp = this.camera.screenToWorld(svgPt);
            this.dragging = {
              type: 'ruler',
              orientation: 'h',
              startScreenX: svgPt.x,
              startScreenY: svgPt.y,
              startWorldPos: wp.y,
            };
            e.preventDefault();
            return;
          }
        }
      },
      true,
    );

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.dragging) return;
      const svgPt = this.clientToSvg(e);
      if (!svgPt) return;

      if (this.dragging.type === 'ruler') {
        const dx = svgPt.x - this.dragging.startScreenX;
        const dy = svgPt.y - this.dragging.startScreenY;
        const dist = Math.abs(this.dragging.orientation === 'v' ? dx : dy);

        if (dist > MIN_DRAG_DIST && !this.dragging.previewLine) {
          this.dragging.previewLine = this.createGuidelineElement(
            this.dragging.orientation,
            this.dragging.orientation === 'v'
              ? this.dragging.startWorldPos
              : this.dragging.startWorldPos,
          );
          this.guidelinesGroup.appendChild(this.dragging.previewLine);
        }

        if (this.dragging.previewLine) {
          if (this.dragging.orientation === 'v') {
            this.dragging.previewLine.setAttribute('x1', String(svgPt.x));
            this.dragging.previewLine.setAttribute('x2', String(svgPt.x));
          } else {
            this.dragging.previewLine.setAttribute('y1', String(svgPt.y));
            this.dragging.previewLine.setAttribute('y2', String(svgPt.y));
          }
        }
      }

      if (this.dragging.type === 'guideline') {
        const wp = this.camera.screenToWorld(svgPt);
        const newPos = this.dragging.orientation === 'v' ? wp.x : wp.y;
        const g = this.guidelines.get(this.dragging.guid!);
        if (g) {
          g.position = newPos;
          this.updateGuidelinePositions();
        }
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (!this.dragging) return;
      const svgPt = this.clientToSvg(e);

      if (this.dragging.type === 'ruler') {
        if (this.dragging.previewLine) {
          if (svgPt) {
            const wp = this.camera.screenToWorld(svgPt);
            const pos = this.dragging.orientation === 'v' ? wp.x : wp.y;
            this.dragging.previewLine.remove();
            this.addGuideline(this.dragging.orientation, pos);
          }
        }
      }

      if (this.dragging.type === 'guideline') {
        const g = this.guidelines.get(this.dragging.guid!);
        if (g) {
          this.events.emit('RULER_GUIDELINE_MOVE', {
            id: this.dragging.guid!,
            orientation: g.orientation,
            position: g.position,
          });
        }
      }

      this.dragging = null;
    });

    this.svg.addEventListener(
      'dblclick',
      (e: MouseEvent) => {
        const svgPt = this.clientToSvg(e);
        if (!svgPt) return;
        const hit = this.hitTestGuideline(svgPt.x, svgPt.y);
        if (hit) {
          this.removeGuideline(hit);
          this.activeGuideline = null;
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.code === 'Delete' || e.code === 'Backspace') {
          if (this.activeGuideline && !this.dragging) {
            this.removeGuideline(this.activeGuideline);
            this.activeGuideline = null;
          }
        }
      },
      true,
    );
  }

  private hitTestGuideline(sx: number, sy: number): string | null {
    for (const [id, g] of this.guidelines) {
      const visible =
        (g.orientation === 'v' && this.guidelinesVisibleV) ||
        (g.orientation === 'h' && this.guidelinesVisibleH);
      if (!visible) continue;
      if (g.orientation === 'v') {
        const lx = parseFloat(g.line.getAttribute('x1') || '0');
        if (Math.abs(sx - lx) <= GUIDELINE_HIT_TOLERANCE) return id;
      } else {
        const ly = parseFloat(g.line.getAttribute('y1') || '0');
        if (Math.abs(sy - ly) <= GUIDELINE_HIT_TOLERANCE) return id;
      }
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
}
