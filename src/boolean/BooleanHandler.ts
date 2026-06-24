import type { SelectionState } from '@/selection/SelectionState';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { BooleanOp, Pt } from './BooleanKernel';
import { booleanOperation } from './BooleanKernel';
import { dString } from './BooleanEngine';
import { PathElement } from '@/shapes/elements/PathElement';
import type { EventBus } from '@/core/EventBus';

const PREVIEW_FILL_COLOR = 'rgba(255, 68, 68, 0.2)';
const PREVIEW_STROKE_COLOR = '#ff4444';
const PREVIEW_ID = 'boolean-preview';

interface VirtualElement {
  id: string;
  localPolygons: Pt[][];
  matrix: DOMMatrix;
}

export class BooleanHandler {
  private selectionState: SelectionState;
  private shapeManager: ShapeManager;
  private svg: SVGSVGElement;
  private events: EventBus;

  private op: BooleanOp = 'UNION';
  private active = false;
  private dragging = false;
  private dragLastSvg = { x: 0, y: 0 };

  private subject: VirtualElement | null = null;
  private subjectEl: AbstractGraphicElement | null = null;
  private clipCache = new Map<string, VirtualElement>();

  private previewEl: PathElement | null = null;
  private previewGroup: SVGGElement | null = null;

  constructor(
    svg: SVGSVGElement,
    selectionState: SelectionState,
    shapeManager: ShapeManager,
    events: EventBus,
  ) {
    this.svg = svg;
    this.selectionState = selectionState;
    this.shapeManager = shapeManager;
    this.events = events;

    this.previewGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    this.previewGroup.setAttribute('pointer-events', 'none');
    this.svg.appendChild(this.previewGroup);

    this.bindEvents();
    this.engineLoop();
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get isDragging(): boolean {
    return this.dragging;
  }

  public enterMode(op: BooleanOp): void {
    this.op = op;
    this.active = true;
    this.events.emit('BOOLEAN_MODE_ENTER', { op });
  }

  public exitMode(): void {
    this.cancel();
    this.active = false;
    this.events.emit('BOOLEAN_MODE_EXIT', {});
  }

  private bindEvents(): void {
    this.svg.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (!this.active || e.button !== 0) return;
        const selected = Array.from(this.selectionState.selected);
        if (selected.length === 0) return;

        const svgPt = this.clientToSvg(e);
        if (!svgPt) return;
        const worldPt = this.cameraToWorld(svgPt);

        const hit = this.hitTestSelected(worldPt, selected);
        if (!hit) return;

        this.startDrag(hit, svgPt);
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    window.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        if (!this.dragging || !this.subject) return;
        const svgPt = this.clientToSvg(e);
        if (!svgPt) return;

        const dx = svgPt.x - this.dragLastSvg.x;
        const dy = svgPt.y - this.dragLastSvg.y;
        this.dragLastSvg = { x: svgPt.x, y: svgPt.y };

        const m = this.subject.matrix;
        const newM = new DOMMatrix([m.a, m.b, m.c, m.d, m.e + dx, m.f + dy]);
        this.subject.matrix = newM;

        this.subjectEl!.transform.matrix = newM;
        this.subjectEl!.markRenderKey('matrix');
        this.subjectEl!.setDirtyTransform();

        this.checkCollisions();
      },
      true,
    );

    window.addEventListener(
      'mouseup',
      (e: MouseEvent) => {
        if (!this.dragging) return;
        if (e.button !== 0) return;
        this.dragging = false;
      },
      true,
    );

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (!this.active) return;
        if (e.key === 'Enter') {
          if (this.tryCommit()) e.preventDefault();
        }
        if (e.key === 'Escape') {
          if (this.dragging || this.previewEl) {
            this.cancel();
            e.preventDefault();
          }
        }
      },
      true,
    );

    this.svg.addEventListener(
      'dblclick',
      (e: MouseEvent) => {
        if (!this.active || !this.dragging || this.clipCache.size === 0) return;
        this.commit();
        e.preventDefault();
      },
      true,
    );
  }

  private engineLoop(): void {
    const tick = (): void => {
      if (this.dragging && this.subject && this.clipCache.size > 0) {
        this.updateResultPreview();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private startDrag(el: AbstractGraphicElement, svgPt: { x: number; y: number }): void {
    this.dragging = true;
    this.dragLastSvg = { x: svgPt.x, y: svgPt.y };

    const localPolygons = el.toSegmentPolygons();
    this.subject = {
      id: el.id,
      localPolygons,
      matrix: DOMMatrix.fromMatrix(el.transform.matrix),
    };
    this.subjectEl = el;
    this.clipCache.clear();

    this.events.emit('BOOLEAN_DRAG_START', { id: el.id, op: this.op });

    this.checkCollisions();
  }

  private checkCollisions(): void {
    if (!this.subject || !this.subjectEl) return;

    const all = this.shapeManager.getAll();
    const subjectWorldPoly = this.applyMatrix(
      this.subject.localPolygons,
      this.subject.matrix,
    );
    const subjectBBox = this.polygonsBBox(subjectWorldPoly);

    const newClipIds = new Set<string>();

    for (const el of all) {
      if (el.id === this.subject.id) continue;
      if (el.id === PREVIEW_ID) continue;
      const poly = el.toSegmentPolygons();
      if (poly.length === 0) continue;
      const mat = el.getTransformMatrix();
      const worldPoly = this.applyMatrix(poly, mat);
      const bbox = this.polygonsBBox(worldPoly);

      if (this.bboxOverlap(subjectBBox, bbox)) {
        newClipIds.add(el.id);
        this.clipCache.set(el.id, {
          id: el.id,
          localPolygons: poly,
          matrix: DOMMatrix.fromMatrix(mat),
        });
      }
    }

    const oldIds = new Set(this.clipCache.keys());
    for (const id of oldIds) {
      if (!newClipIds.has(id)) {
        this.clipCache.delete(id);
      }
    }

    if (newClipIds.size === 0) {
      this.hidePreview();
    }
  }

  private updateResultPreview(): void {
    if (!this.subject || this.clipCache.size === 0) return;

    const subjectWorld = this.applyMatrix(
      this.subject.localPolygons,
      this.subject.matrix,
    );

    const allClipWorld: Pt[][] = [];
    for (const clip of this.clipCache.values()) {
      allClipWorld.push(...this.applyMatrix(clip.localPolygons, clip.matrix));
    }

    const result = booleanOperation(subjectWorld, allClipWorld, this.op);
    if (result.length === 0) {
      this.hidePreview();
      return;
    }

    const commands = this.polygonsToCommands(result);

    if (!this.previewEl) {
      this.previewEl = new PathElement(PREVIEW_ID);
      this.previewEl.setFill(PREVIEW_FILL_COLOR);
      this.previewEl.setStroke(PREVIEW_STROKE_COLOR);
      this.previewEl.setStrokeWidth(1);
      this.previewEl.transform.reset();
    }

    this.previewEl.commands = commands;
    this.previewEl.buildHitArea();
    this.previewEl.setDirtyAll();
  }

  private hidePreview(): void {
    if (this.previewEl) {
      this.previewEl = null;
    }
  }

  private tryCommit(): boolean {
    if (!this.active) return false;
    const selected = Array.from(this.selectionState.selected);
    if (selected.length === 0) return false;

    if (!this.subject) {
      const el = selected[0];
      this.startDrag(el, this.dragLastSvg);
      this.checkCollisions();
    }

    if (this.clipCache.size === 0) {
      console.log('[Boolean] commit skipped — no clips');
      return false;
    }

    this.commit();
    return true;
  }

  public commit(): void {
    if (!this.subject) return;

    const subjectWorld = this.applyMatrix(
      this.subject.localPolygons,
      this.subject.matrix,
    );
    const subjectBBox = this.polygonsBBox(subjectWorld);

    const allClipWorld: Pt[][] = [];
    for (const clip of this.clipCache.values()) {
      const clipWorld = this.applyMatrix(clip.localPolygons, clip.matrix);
      allClipWorld.push(...clipWorld);
    }

    console.log('[Boolean] === COMMIT ===');
    console.log('[Boolean] subject:', this.subject.id);
    console.log('[Boolean] subject localPolygons:', JSON.stringify(this.subject.localPolygons));
    console.log('[Boolean] subject matrix:', [...this.subject.matrix.toFloat32Array()]);
    console.log('[Boolean] subject worldBBox:', subjectBBox);
    console.log('[Boolean] subject worldPoly:', JSON.stringify(subjectWorld));
    for (const clip of this.clipCache.values()) {
      const cw = this.applyMatrix(clip.localPolygons, clip.matrix);
      const cb = this.polygonsBBox(cw);
      console.log('[Boolean] clip:', clip.id);
      console.log('[Boolean] clip localPolygons:', JSON.stringify(clip.localPolygons));
      console.log('[Boolean] clip matrix:', [...clip.matrix.toFloat32Array()]);
      console.log('[Boolean] clip worldBBox:', cb);
      console.log('[Boolean] clip worldPoly:', JSON.stringify(cw));
    }

    const result = booleanOperation(subjectWorld, allClipWorld, this.op);
    console.log('[Boolean] op:', this.op);
    console.log('[Boolean] result polygons:', JSON.stringify(result));
    if (result.length === 0) {
      this.cancel();
      return;
    }

    const commands = this.polygonsToCommands(result);
    const d = dString(commands);

    this.hidePreview();

    for (const id of this.clipCache.keys()) {
      this.shapeManager.removeElementAndNode(id);
    }
    this.shapeManager.removeElementAndNode(this.subject.id);

    const newEl = new PathElement(crypto.randomUUID());
    newEl.commands = commands;
    newEl.setFill('#cccccc');
    newEl.setStroke('#000000');
    newEl.setStrokeWidth(2);
    newEl.buildHitArea();
    newEl.setDirtyAll();
    this.shapeManager.addElement(newEl);

    this.selectionState.clear();
    this.selectionState.add([newEl]);

    this.events.emit('BOOLEAN_COMMIT', {
      op: this.op,
      subjectId: this.subject.id,
      clipIds: Array.from(this.clipCache.keys()),
      newId: newEl.id,
      d,
    });

    this.cleanup();
  }

  public cancel(): void {
    this.hidePreview();
    this.events.emit('BOOLEAN_CANCEL', { op: this.op });
    this.cleanup();
  }

  private cleanup(): void {
    this.subject = null;
    this.subjectEl = null;
    this.clipCache.clear();
    this.dragging = false;
  }

  private hitTestSelected(
    worldPt: { x: number; y: number },
    selected: AbstractGraphicElement[],
  ): AbstractGraphicElement | null {
    for (const s of selected) {
      const poly = s.toSegmentPolygons();
      if (poly.length === 0) continue;
      const worldPoly = this.applyMatrix(poly, s.getTransformMatrix());
      if (this.pointInPolygons(worldPt, worldPoly)) return s;
    }
    return null;
  }

  private applyMatrix(polygons: Pt[][], m: DOMMatrix): Pt[][] {
    return polygons.map((ring) =>
      ring.map((p) => {
        const tp = m.transformPoint({ x: p.x, y: p.y });
        return { x: tp.x, y: tp.y };
      }),
    );
  }

  private polygonsBBox(polygons: Pt[][]): {
    x: number;
    y: number;
    w: number;
    h: number;
  } {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const ring of polygons) {
      for (const p of ring) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  private bboxOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  private pointInPolygons(pt: { x: number; y: number }, polygons: Pt[][]): boolean {
    for (const ring of polygons) {
      if (ring.length < 3) continue;
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        if (
          ring[i].y > pt.y !== ring[j].y > pt.y &&
          pt.x <
            ((ring[j].x - ring[i].x) * (pt.y - ring[i].y)) /
              (ring[j].y - ring[i].y) +
              ring[i].x
        ) {
          inside = !inside;
        }
      }
      if (inside) return true;
    }
    return false;
  }

  private polygonsToCommands(polygons: Pt[][]): import('@/types').PathCommand[] {
    const cmds: import('@/types').PathCommand[] = [];
    for (const ring of polygons) {
      if (ring.length < 2) continue;
      cmds.push({ command: 'M', args: [ring[0].x, ring[0].y] });
      for (let i = 1; i < ring.length; i++) {
        cmds.push({ command: 'L', args: [ring[i].x, ring[i].y] });
      }
      cmds.push({ command: 'Z', args: [] });
    }
    return cmds;
  }

  private clientToSvg(e: MouseEvent): { x: number; y: number } | null {
    const point = this.svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    return point.matrixTransform(ctm.inverse());
  }

  private cameraToWorld(
    svgPt: { x: number; y: number },
  ): { x: number; y: number } {
    return { x: svgPt.x, y: svgPt.y };
  }
}
