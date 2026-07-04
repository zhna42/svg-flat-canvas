import type { SelectionState } from '@/canvas/overlays/selection/SelectionState';
import type { ShapeManager } from '@/shapes/ShapeManager';
import type { HitTestEngine } from '@/core/HitTestEngine';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { BooleanOp, Pt } from '@/types';
import { booleanOperation } from './BooleanKernel';
import { dString } from './BooleanEngine';
import { PreviewElement } from '@/shapes/elements/PreviewElement';
import type { EventBus } from '@/core/EventBus';
import type { CommandBus } from '@/commands/CommandBus';
import { polyIntersectsPoly } from '@/core/HitTestEngine';

const PREVIEW_FILL_COLOR = '#ff0000';
const PREVIEW_STROKE_COLOR = '#cc0000';
const PREVIEW_ID = 'boolean-preview';

export class BooleanHandler {
  private selectionState: SelectionState;
  private shapeManager: ShapeManager;
  private hitTestEngine: HitTestEngine;
  private svg: SVGSVGElement;
  private events: EventBus;
  private commandBus: CommandBus;

  private op: BooleanOp = 'UNION';
  private active = false;
  private dragging = false;

  private subjectIds: string[] = [];
  private clipIds: string[] = [];

  private previewEl: PreviewElement | null = null;
  private lastKnownBBoxes = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();

  constructor(
    svg: SVGSVGElement,
    selectionState: SelectionState,
    shapeManager: ShapeManager,
    hitTestEngine: HitTestEngine,
    events: EventBus,
    commandBus: CommandBus,
  ) {
    this.svg = svg;
    this.selectionState = selectionState;
    this.shapeManager = shapeManager;
    this.hitTestEngine = hitTestEngine;
    this.events = events;
    this.commandBus = commandBus;

    this.createPreviewElement();
    this.engineLoop();
  }

  public get isActive(): boolean {
    return this.active;
  }

  public onMouseDown(e: MouseEvent): boolean {
    if (!this.active || e.button !== 0) return false;
    const selected = Array.from(this.selectionState.selected);
    if (selected.length === 0) return false;
    const svgPt = this.clientToSvg(e);
    if (!svgPt) return false;
    const { hits } = this.hitTestEngine.queryPoint(svgPt.x, svgPt.y);
    const hitOnSelected = hits.find((h) => selected.some((s) => s.id === h.id));
    if (!hitOnSelected) return false;
    this.subjectIds = selected.map((s) => s.id);
    for (const s of selected) {
      const b = s.getWorldBBox();
      this.lastKnownBBoxes.set(s.id, {
        x: b.x,
        y: b.y,
        w: b.width,
        h: b.height,
      });
    }
    this.clipIds = [];
    return true;
  }

  public onKeyDown(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    if (e.key === 'Enter') {
      if (this.subjectIds.length > 0 && this.clipIds.length > 0) {
        this.commit();
        e.preventDefault();
        return true;
      }
    }
    if (e.key === 'Escape') {
      this.cancel();
      e.preventDefault();
      return true;
    }
    return false;
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
    this.previewEl = new PreviewElement(PREVIEW_ID);
    this.previewEl.style.fill = PREVIEW_FILL_COLOR;
    this.previewEl.style.stroke = PREVIEW_STROKE_COLOR;
    this.previewEl.style.strokeWidth = 1;
    this.previewEl.visible = false;
    this.shapeManager.addPreviewElement(this.previewEl);
  }

  private removePreviewElement(): void {
    if (this.previewEl) {
      this.shapeManager.removePreviewElement(PREVIEW_ID);
      this.previewEl = null;
    }
  }

  private showPreview(): void {
    if (this.previewEl) {
      this.previewEl.visible = true;
    }
  }

  private hidePreview(): void {
    if (this.previewEl) {
      this.previewEl.visible = false;
    }
  }

  private engineLoop(): void {
    const tick = (): void => {
      if (!this.active) {
        requestAnimationFrame(tick);
        return;
      }

      const selected = Array.from(this.selectionState.selected);
      if (selected.length > 0) {
        const selectedIds = new Set(selected.map((s) => s.id));
        if (
          this.subjectIds.length === 0 ||
          !this.subjectIds.some((id) => selectedIds.has(id))
        ) {
          this.subjectIds = [...selectedIds];
          for (const s of selected) {
            const b = s.getWorldBBox();
            this.lastKnownBBoxes.set(s.id, {
              x: b.x,
              y: b.y,
              w: b.width,
              h: b.height,
            });
          }
        }
        this.dragging = this.detectMovement(selected);
        const newClipIds = this.findCollidingIds();
        this.updateClipFade(newClipIds);
        this.clipIds = newClipIds;
        if (this.clipIds.length > 0) {
          this.updateResultPreview();
        } else {
          this.hidePreview();
        }
      } else {
        if (this.subjectIds.length > 0) {
          this.hidePreview();
          this.unfadeAllClips();
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
      if (
        !prev ||
        Math.abs(b.x - prev.x) > 0.5 ||
        Math.abs(b.y - prev.y) > 0.5
      ) {
        moved = true;
      }
      this.lastKnownBBoxes.set(el.id, {
        x: b.x,
        y: b.y,
        w: b.width,
        h: b.height,
      });
    }
    for (const key of this.lastKnownBBoxes.keys()) {
      if (!seen.has(key)) this.lastKnownBBoxes.delete(key);
    }
    return moved;
  }

  private updateClipFade(newIds: string[]): void {
    const oldSet = new Set(this.clipIds);
    const newSet = new Set(newIds);
    for (const id of oldSet) {
      if (!newSet.has(id)) {
        const el = this.shapeManager.getById(id);
        if (el) el.setFaded(false);
      }
    }
    for (const id of newSet) {
      if (!oldSet.has(id)) {
        const el = this.shapeManager.getById(id);
        if (el) el.setFaded(true);
      }
    }
  }

  private unfadeAllClips(): void {
    for (const id of this.clipIds) {
      const el = this.shapeManager.getById(id);
      if (el) el.setFaded(false);
    }
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
      const mat = el.transform.matrix;
      subjectPolygons.push(
        ...local.map((ring) =>
          ring.map((p) => {
            const tp = mat.transformPoint({ x: p.x, y: p.y });
            return { x: tp.x, y: tp.y };
          }),
        ),
      );
    }

    const clipPolygons: Pt[][] = [];
    for (const id of this.clipIds) {
      const el = this.shapeManager.getById(id);
      if (!el) continue;
      const local = el.toSegmentPolygons();
      const mat = el.transform.matrix;
      clipPolygons.push(
        ...local.map((ring) =>
          ring.map((p) => {
            const tp = mat.transformPoint({ x: p.x, y: p.y });
            return { x: tp.x, y: tp.y };
          }),
        ),
      );
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
      const mat = el.transform.matrix;
      subjectPolygons.push(
        ...local.map((ring) =>
          ring.map((p) => {
            const tp = mat.transformPoint({ x: p.x, y: p.y });
            return { x: tp.x, y: tp.y };
          }),
        ),
      );
    }

    const clipPolygons: Pt[][] = [];
    for (const id of this.clipIds) {
      const el = this.shapeManager.getById(id);
      if (!el) continue;
      const local = el.toSegmentPolygons();
      const mat = el.transform.matrix;
      clipPolygons.push(
        ...local.map((ring) =>
          ring.map((p) => {
            const tp = mat.transformPoint({ x: p.x, y: p.y });
            return { x: tp.x, y: tp.y };
          }),
        ),
      );
    }

    const result = booleanOperation(subjectPolygons, clipPolygons, this.op);
    if (result.length === 0) {
      this.cancel();
      return;
    }

    const commands: import('@/types').PathCommand[] = [];
    for (const ring of result) {
      commands.push({ command: 'M', args: [ring[0].x, ring[0].y] });
      for (let i = 1; i < ring.length; i++)
        commands.push({ command: 'L', args: [ring[i].x, ring[i].y] });
      commands.push({ command: 'Z', args: [] });
    }

    this.hidePreview();

    this.commandBus.execute({
      type: 'BOOLEAN_OPERATION',
      options: {
        subjectIds: this.subjectIds,
        clipIds: this.clipIds,
        resultCommands: commands,
        resultFill: '#cccccc',
        resultStroke: '#000000',
      },
    });

    this.events.emit('BOOLEAN_COMMIT', {
      op: this.op,
      subjectIds: this.subjectIds,
      clipIds: this.clipIds,
    });

    this.cleanup();
  }

  public cancel(): void {
    this.hidePreview();
    this.events.emit('BOOLEAN_CANCEL', { op: this.op });
    this.cleanup();
  }

  private cleanup(): void {
    this.unfadeAllClips();
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
