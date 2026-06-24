import type { SelectionState } from '@/selection/SelectionState';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { SpatialGrid } from '@/spatial/SpatialGrid';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { BooleanOp, Pt } from './BooleanKernel';
import { booleanOperation } from './BooleanKernel';
import { dString } from './BooleanEngine';
import { PathElement } from '@/shapes/elements/PathElement';
import type { EventBus } from '@/core/EventBus';
import { hitTestByPoint } from '@/spatial/hit-test';
import { polyIntersectsPoly } from '@/spatial/hit-test';

const PREVIEW_FILL_COLOR = 'rgba(255, 68, 68, 0.2)';
const PREVIEW_STROKE_COLOR = '#ff4444';
const PREVIEW_ID = 'boolean-preview';

export class BooleanHandler {
  private selectionState: SelectionState;
  private shapeManager: ShapeManager;
  private grid: SpatialGrid;
  private svg: SVGSVGElement;
  private events: EventBus;

  private op: BooleanOp = 'UNION';
  private active = false;
  private dragging = false;

  private subjectIds: string[] = [];
  private clipIds: string[] = [];

  private previewEl: PathElement | null = null;
  private cameraGroup: SVGGElement;
  private lastKnownBBoxes = new Map<string, { x: number; y: number; w: number; h: number }>();

  constructor(
    svg: SVGSVGElement,
    selectionState: SelectionState,
    shapeManager: ShapeManager,
    grid: SpatialGrid,
    events: EventBus,
    cameraGroup: SVGGElement,
  ) {
    this.svg = svg;
    this.selectionState = selectionState;
    this.shapeManager = shapeManager;
    this.grid = grid;
    this.events = events;
    this.cameraGroup = cameraGroup;

    this.svg.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.active || e.button !== 0) return;
      const selected = Array.from(this.selectionState.selected);
      if (selected.length === 0) return;
      const svgPt = this.clientToSvg(e);
      if (!svgPt) return;
      const hits = hitTestByPoint(svgPt.x, svgPt.y, this.shapeManager.getAll(), this.grid);
      const hitOnSelected = hits.find((h) => selected.some((s) => s.id === h.id));
      if (!hitOnSelected) return;
      this.subjectIds = selected.map((s) => s.id);
      for (const s of selected) {
        const b = s.getWorldBBox();
        this.lastKnownBBoxes.set(s.id, { x: b.x, y: b.y, w: b.width, h: b.height });
      }
      this.clipIds = [];
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.active) return;
      if (e.key === 'Enter') {
        if (this.subjectIds.length > 0 && this.clipIds.length > 0) {
          this.commit();
          e.preventDefault();
        }
      }
      if (e.key === 'Escape') {
        this.cancel();
        e.preventDefault();
      }
    });

    this.createPreviewElement();
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
    this.removePreviewElement();
    this.events.emit('BOOLEAN_MODE_EXIT', {});
  }

  private createPreviewElement(): void {
    this.previewEl = new PathElement(PREVIEW_ID);
    this.previewEl.setFill(PREVIEW_FILL_COLOR);
    this.previewEl.setStroke(PREVIEW_STROKE_COLOR);
    this.previewEl.setStrokeWidth(1);
    this.previewEl.setVisible(false);
    this.shapeManager.addElement(this.previewEl);
  }

  private removePreviewElement(): void {
    if (this.previewEl) {
      this.shapeManager.removeElementAndNode(PREVIEW_ID);
      this.previewEl = null;
    }
  }

  private showPreview(): void {
    if (this.previewEl) {
      this.previewEl.setVisible(true);
      this.previewEl.requestRender();
      for (let i = this.cameraGroup.children.length - 1; i >= 0; i--) {
        const child = this.cameraGroup.children[i];
        if (child.getAttribute('fill') === PREVIEW_FILL_COLOR) {
          this.cameraGroup.appendChild(child);
          break;
        }
      }
    }
  }

  private hidePreview(): void {
    if (this.previewEl) {
      this.previewEl.setVisible(false);
      this.previewEl.requestRender();
    }
  }

  private engineLoop(): void {
    const tick = (): void => {
      if (!this.active) { requestAnimationFrame(tick); return; }

      const selected = Array.from(this.selectionState.selected);
      if (selected.length > 0) {
        const selectedIds = new Set(selected.map((s) => s.id));
        if (this.subjectIds.length === 0 || !this.subjectIds.some((id) => selectedIds.has(id))) {
          this.subjectIds = [...selectedIds];
          for (const s of selected) {
            const b = s.getWorldBBox();
            this.lastKnownBBoxes.set(s.id, { x: b.x, y: b.y, w: b.width, h: b.height });
          }
        }
        this.dragging = this.detectMovement(selected);
        this.clipIds = this.findCollidingIds();
        if (this.clipIds.length > 0) {
          this.updateResultPreview();
        } else {
          this.hidePreview();
        }
      } else {
        if (this.subjectIds.length > 0) {
          this.hidePreview();
          this.subjectIds = [];
          this.clipIds = [];
          this.dragging = false;
        }
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private detectMovement(selected: AbstractGraphicElement[]): boolean {
    let moved = false;
    const seen = new Set<string>();
    for (const el of selected) {
      seen.add(el.id);
      const b = el.getWorldBBox();
      const prev = this.lastKnownBBoxes.get(el.id);
      if (!prev || Math.abs(b.x - prev.x) > 0.5 || Math.abs(b.y - prev.y) > 0.5) {
        moved = true;
      }
      this.lastKnownBBoxes.set(el.id, { x: b.x, y: b.y, w: b.width, h: b.height });
    }
    for (const key of this.lastKnownBBoxes.keys()) {
      if (!seen.has(key)) this.lastKnownBBoxes.delete(key);
    }
    return moved;
  }

  private findCollidingIds(): string[] {
    const all = this.shapeManager.getAll();
    const selectedSet = new Set(this.subjectIds);
    const result: string[] = [];

    for (const sId of this.subjectIds) {
      const sEl = this.shapeManager.getById(sId);
      if (!sEl) continue;
      const sBBox = sEl.getWorldBBox();
      const sHit = sEl.getWorldHitPoints();
      const candidates = all.filter((c) => {
        if (selectedSet.has(c.id)) return false;
        if (c.id === PREVIEW_ID) return false;
        const cBBox = c.getWorldBBox();
        return (
          sBBox.x < cBBox.x + cBBox.width &&
          sBBox.x + sBBox.width > cBBox.x &&
          sBBox.y < cBBox.y + cBBox.height &&
          sBBox.y + sBBox.height > cBBox.y
        );
      });
      for (const c of candidates) {
        const cHit = c.getWorldHitPoints();
        if (polyIntersectsPoly(sHit, cHit)) {
          if (c.toSegmentPolygons().length > 0) {
            result.push(c.id);
          }
        }
      }
    }
    return [...new Set(result)];
  }

  private updateResultPreview(): void {
    if (this.subjectIds.length === 0 || this.clipIds.length === 0) {
      this.hidePreview();
      return;
    }

    const subjectPolygons: Pt[][] = [];
    for (const id of this.subjectIds) {
      const el = this.shapeManager.getById(id);
      if (!el) continue;
      const local = el.toSegmentPolygons();
      const mat = el.getTransformMatrix();
      subjectPolygons.push(...local.map((ring) =>
        ring.map((p) => { const tp = mat.transformPoint({ x: p.x, y: p.y }); return { x: tp.x, y: tp.y }; }),
      ));
    }

    const clipPolygons: Pt[][] = [];
    for (const id of this.clipIds) {
      const el = this.shapeManager.getById(id);
      if (!el) continue;
      const local = el.toSegmentPolygons();
      const mat = el.getTransformMatrix();
      clipPolygons.push(...local.map((ring) =>
        ring.map((p) => { const tp = mat.transformPoint({ x: p.x, y: p.y }); return { x: tp.x, y: tp.y }; }),
      ));
    }

    const result = booleanOperation(subjectPolygons, clipPolygons, this.op);
    if (result.length === 0) {
      this.hidePreview();
      return;
    }

    const commands: import('@/types').PathCommand[] = [];
    for (const ring of result) {
      if (ring.length < 2) continue;
      commands.push({ command: 'M', args: [ring[0].x, ring[0].y] });
      for (let i = 1; i < ring.length; i++) {
        commands.push({ command: 'L', args: [ring[i].x, ring[i].y] });
      }
      commands.push({ command: 'Z', args: [] });
    }

    if (this.previewEl) {
      this.previewEl.d = dString(commands);
      this.previewEl.requestRender();
      this.showPreview();
    }
  }

  public commit(): void {
    if (this.subjectIds.length === 0) return;

    const subjectPolygons: Pt[][] = [];
    for (const id of this.subjectIds) {
      const el = this.shapeManager.getById(id);
      if (!el) continue;
      const local = el.toSegmentPolygons();
      const mat = el.getTransformMatrix();
      subjectPolygons.push(...local.map((ring) => ring.map((p) => { const tp = mat.transformPoint({ x: p.x, y: p.y }); return { x: tp.x, y: tp.y }; })));
    }

    const clipPolygons: Pt[][] = [];
    for (const id of this.clipIds) {
      const el = this.shapeManager.getById(id);
      if (!el) continue;
      const local = el.toSegmentPolygons();
      const mat = el.getTransformMatrix();
      clipPolygons.push(...local.map((ring) => ring.map((p) => { const tp = mat.transformPoint({ x: p.x, y: p.y }); return { x: tp.x, y: tp.y }; })));
    }

    const result = booleanOperation(subjectPolygons, clipPolygons, this.op);
    if (result.length === 0) { this.cancel(); return; }

    const commands: import('@/types').PathCommand[] = [];
    for (const ring of result) {
      commands.push({ command: 'M', args: [ring[0].x, ring[0].y] });
      for (let i = 1; i < ring.length; i++) commands.push({ command: 'L', args: [ring[i].x, ring[i].y] });
      commands.push({ command: 'Z', args: [] });
    }
    const d = dString(commands);

    this.hidePreview();

    for (const id of this.clipIds) this.shapeManager.removeElementAndNode(id);
    for (const id of this.subjectIds) this.shapeManager.removeElementAndNode(id);

    const newEl = new PathElement(crypto.randomUUID());
    newEl.d = d;
    newEl.setFill('#cccccc');
    newEl.setStroke('#000000');
    newEl.setStrokeWidth(2);
    newEl.buildHitArea();
    newEl.setDirtyAll();
    this.shapeManager.addElement(newEl);
    this.selectionState.clear();
    this.selectionState.add([newEl]);
    this.events.emit('BOOLEAN_COMMIT', { op: this.op, newId: newEl.id, d });
    this.cleanup();
  }

  public cancel(): void {
    this.hidePreview();
    this.events.emit('BOOLEAN_CANCEL', { op: this.op });
    this.cleanup();
  }

  private cleanup(): void {
    this.subjectIds = [];
    this.clipIds = [];
    this.dragging = false;
    this.lastKnownBBoxes.clear();
  }

  private clientToSvg(e: MouseEvent): { x: number; y: number } | null {
    const point = this.svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    return point.matrixTransform(ctm.inverse());
  }
}
