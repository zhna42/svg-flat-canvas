import type { Camera } from '@/canvas/Camera';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Point, NodeKind, NodeHit, INodeEditable } from '@/types';
import { PathElement } from '@/shapes/elements/PathElement';
import { NodeEditSession } from './NodeEditSession';
import { NodeEditRenderer } from './NodeEditRenderer';
import { NodeEditTimeMachine } from './NodeEditTimeMachine';
import { NodeSnapHelper } from './NodeSnapHelper';

const HIT_PX = 8;

export interface NodeEditDeps {
  camera: Camera;
  getElement: (id: string) => AbstractGraphicElement | undefined;
  getAllElements: () => AbstractGraphicElement[];
  /** Конвертировать элемент (polyline/polygon) в PathElement с тем же id. */
  convertToPath: (id: string) => PathElement | null;
  onEnter?: (ids: string[]) => void;
  onExit?: () => void;
  onSelectionChange?: (count: number) => void;
  /** Скрыть обводку выделения (transform-бокс) на время правки узлов. */
  hideSelectionOverlay?: () => void;
  /** Восстановить обводку выделения после выхода. */
  restoreSelectionOverlay?: () => void;
}

function isNodeEditable(
  el: unknown,
): el is INodeEditable & AbstractGraphicElement {
  return !!el && typeof (el as INodeEditable).toEditModel === 'function';
}

interface DragState {
  hit: NodeHit;
  last: Point;
  moved: boolean;
}

export class NodeEditCoordinator {
  public readonly session = new NodeEditSession();
  public readonly renderer = new NodeEditRenderer();
  private readonly snap: NodeSnapHelper;
  private timeMachine: NodeEditTimeMachine | null = null;
  private deps: NodeEditDeps;
  private editingIds = new Set<string>();
  private drag: DragState | null = null;

  constructor(deps: NodeEditDeps) {
    this.deps = deps;
    this.snap = new NodeSnapHelper(deps.camera, deps.getAllElements);

    this.session.onGeometryChange = (id): void => {
      this.applyBack(id);
      this.renderOverlay();
    };
    this.session.onSelectionChange = (): void => {
      this.renderOverlay();
      this.deps.onSelectionChange?.(this.session.getSelectedCount());
    };
  }

  // ── Lifecycle ──

  public get isActive(): boolean {
    return !this.session.isEmpty;
  }

  public isEditingElement(id: string): boolean {
    return this.editingIds.has(id);
  }

  public enter(elements: AbstractGraphicElement[]): void {
    const editable = elements.filter(isNodeEditable);
    if (editable.length === 0) return;
    this.exit();

    const models = editable.map((el) => {
      el.isEditingNodes = true;
      return el.toEditModel();
    });
    this.editingIds = new Set(editable.map((el) => el.id));
    this.session.setTargets(models);
    this.deps.hideSelectionOverlay?.();
    this.timeMachine = new NodeEditTimeMachine(this.session, (id) => {
      this.applyBack(id);
    });
    this.renderOverlay();
    this.deps.onEnter?.(Array.from(this.editingIds));
  }

  public exit(): void {
    if (this.session.isEmpty) return;
    for (const id of this.editingIds) {
      const el = this.deps.getElement(id);
      if (el) el.isEditingNodes = false;
    }
    this.editingIds.clear();
    this.session.clear();
    this.deps.restoreSelectionOverlay?.();
    this.timeMachine?.clear();
    this.timeMachine = null;
    this.drag = null;
    this.renderer.clear();
    this.deps.onExit?.();
  }

  // ── Camera ──

  public onZoomChange(): void {
    if (this.isActive) this.renderer.setZoom(this.deps.camera.zoom);
  }

  private renderOverlay(): void {
    this.renderer.render(this.session.getTargets(), this.deps.camera.zoom);
  }

  // ── Write-back (+ авто-конверсия в path при кривизне) ──

  private applyBack(id: string): void {
    const el = this.deps.getElement(id);
    if (!el || !isNodeEditable(el)) return;
    const model = this.session.getModel(id);
    if (!model) return;

    let editable: INodeEditable = el;
    if (!el.supportsCurves && this.session.hasCurves(id)) {
      const path = this.deps.convertToPath(id);
      if (path) editable = path;
    }
    editable.applyEditModel(model);
  }

  // ── Hit test ──

  public hitNode(worldX: number, worldY: number): NodeHit | null {
    const r = HIT_PX / this.deps.camera.zoom;
    return this.session.hitNode(worldX, worldY, r);
  }

  // ── Pointer (drag / click) ──

  public get isDragging(): boolean {
    return this.drag !== null;
  }

  /** Начать взаимодействие с узлом. Возвращает true, если попали. */
  public pointerDown(worldPt: Point): boolean {
    const hit = this.hitNode(worldPt.x, worldPt.y);
    if (!hit) return false;

    if (hit.part === 'anchor') {
      const t = this.session
        .getTargets()
        .find((x) => x.elementId === hit.elementId);
      const already = t?.selection.has(hit.nodeId);
      if (!already) {
        if (this.session.multiSelectMode)
          this.session.toggle(hit.elementId, hit.nodeId);
        else this.session.selectSingle(hit.elementId, hit.nodeId);
      }
    }
    this.snap.buildTargets(this.editingIds, this.collectSnapNodes(hit));
    this.drag = { hit, last: { x: worldPt.x, y: worldPt.y }, moved: false };
    return true;
  }

  public pointerMove(worldPt: Point): void {
    if (!this.drag) return;
    const frameDx = worldPt.x - this.drag.last.x;
    const frameDy = worldPt.y - this.drag.last.y;
    if (Math.abs(frameDx) > 1e-6 || Math.abs(frameDy) > 1e-6)
      this.drag.moved = true;
    this.drag.last = { x: worldPt.x, y: worldPt.y };

    const { hit } = this.drag;
    if (hit.part === 'anchor') {
      const snapped = this.snap.snapPoint(worldPt, frameDx, frameDy);
      const anchor = this.session.getNodeAnchor(hit.elementId, hit.nodeId);
      if (anchor) {
        this.session.moveSelected(snapped.x - anchor.x, snapped.y - anchor.y);
      }
    } else {
      const snapped = this.snap.snapPoint(worldPt, frameDx, frameDy);
      this.session.moveHandle(hit.elementId, hit.nodeId, hit.part, snapped.x, snapped.y);
    }
  }

  public pointerUp(): void {
    if (!this.drag) return;
    const moved = this.drag.moved;
    this.drag = null;
    this.snap.reset();
    if (moved) this.commit();
  }

  private collectSnapNodes(hit: NodeHit): Point[] {
    const pts: Point[] = [];
    for (const t of this.session.getTargets()) {
      for (const c of t.contours) {
        for (const n of c.nodes) {
          if (t.elementId === hit.elementId && n.id === hit.nodeId) continue;
          pts.push(n.anchor);
        }
      }
    }
    return pts;
  }

  // ── Insert node on dbl-click ──

  public insertAt(worldX: number, worldY: number): boolean {
    const maxD = 12 / this.deps.camera.zoom;
    let best: {
      elementId: string;
      contourIdx: number;
      segIdx: number;
      t: number;
      dist: number;
    } | null = null;

    for (const target of this.session.getTargets()) {
      target.contours.forEach((contour, contourIdx) => {
        const n = contour.nodes.length;
        const segCount = contour.closed ? n : n - 1;
        for (let s = 0; s < segCount; s++) {
          const a = contour.nodes[s];
          const b = contour.nodes[(s + 1) % n];
          const res = nearestOnSegment(worldX, worldY, a, b);
          if (res.dist < (best?.dist ?? Infinity)) {
            best = {
              elementId: target.elementId,
              contourIdx,
              segIdx: s,
              t: res.t,
              dist: res.dist,
            };
          }
        }
      });
    }
    const chosen = best as {
      elementId: string;
      contourIdx: number;
      segIdx: number;
      t: number;
      dist: number;
    } | null;
    if (!chosen || chosen.dist > maxD) return false;
    const nodeId = this.session.insertNode(
      chosen.elementId,
      chosen.contourIdx,
      chosen.segIdx,
      chosen.t,
    );
    if (nodeId) {
      this.session.selectSingle(chosen.elementId, nodeId);
      this.commit();
      return true;
    }
    return false;
  }

  // ── API operations ──

  public setMultiSelect(on: boolean): void {
    this.session.multiSelectMode = on;
  }
  public getMultiSelect(): boolean {
    return this.session.multiSelectMode;
  }

  public deleteSelected(): void {
    this.session.deleteSelected();
    this.commit();
  }
  public setSelectedType(kind: NodeKind): void {
    this.session.setSelectedType(kind);
    this.commit();
  }
  public smoothSelected(): void {
    this.session.smoothSelected();
    this.commit();
  }
  public sharpenSelected(): void {
    this.session.sharpenSelected();
    this.commit();
  }
  public distributeEvenly(): void {
    this.session.distributeSelectedEvenly();
    this.commit();
  }
  public nudge(dx: number, dy: number): void {
    this.session.moveSelected(dx, dy);
    this.commit();
  }
  public selectAll(): void {
    this.session.selectAll();
  }
  public clearSelection(): void {
    this.session.clearSelection();
  }
  public invertSelection(): void {
    this.session.invertSelection();
  }
  public getSelectedCount(): number {
    return this.session.getSelectedCount();
  }

  public clickEmpty(): void {
    if (!this.session.multiSelectMode) this.session.clearSelection();
  }

  public undo(): void {
    this.timeMachine?.undo();
    this.renderOverlay();
  }
  public redo(): void {
    this.timeMachine?.redo();
    this.renderOverlay();
  }

  private commit(): void {
    this.timeMachine?.capture();
  }
}

function nearestOnSegment(
  x: number,
  y: number,
  a: { anchor: Point; handleOut?: Point },
  b: { anchor: Point; handleIn?: Point },
): { t: number; dist: number } {
  if (a.handleOut || b.handleIn) {
    const p0 = a.anchor;
    const p1 = a.handleOut ?? a.anchor;
    const p2 = b.handleIn ?? b.anchor;
    const p3 = b.anchor;
    let bestT = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const mt = 1 - t;
      const px =
        mt * mt * mt * p0.x +
        3 * mt * mt * t * p1.x +
        3 * mt * t * t * p2.x +
        t * t * t * p3.x;
      const py =
        mt * mt * mt * p0.y +
        3 * mt * mt * t * p1.y +
        3 * mt * t * t * p2.y +
        t * t * t * p3.y;
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        bestD = d;
        bestT = t;
      }
    }
    return { t: bestT, dist: bestD };
  }
  const ax = a.anchor.x;
  const ay = a.anchor.y;
  const bx = b.anchor.x;
  const by = b.anchor.y;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((x - ax) * dx + (y - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + dx * t;
  const py = ay + dy * t;
  return { t, dist: Math.hypot(x - px, y - py) };
}
