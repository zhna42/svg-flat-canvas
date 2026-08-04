import type { Camera } from '@/canvas/Camera';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { Point, NodeKind, NodeHit, INodeEditable } from '@/core/type';
import type { EventBus } from '@/core/event-bus/EventBus';
import { PathElement } from '@/core/shapes/elements/PathElement';
import { NodeEditOverlayElement } from '@/core/shapes/elements/NodeEditOverlayElement';
import { NodeEditSession } from './NodeEditSession';
import { NodeSnapHelper } from './NodeSnapHelper';
import type { CreationHandler } from '@/manager/commands/handlers/creation/CreationHandler';
import type { AreaSelectionManager } from '@/canvas/overlays/selection/AreaSelectionManager';

const HIT_PX = 5400;
const ANCHOR_PX = 1440;
const CTRL_R_SCREEN = 1152;

export interface NodeEditDeps {
  camera: Camera;
  getElement: (id: string) => AbstractGraphicElement | undefined;
  getAllElements: () => AbstractGraphicElement[];
  convertToPath: (id: string) => PathElement | null;
  getOverlayElement: () => NodeEditOverlayElement;
  events: EventBus;
  creationHandler?: () => CreationHandler | undefined;
  areaSelectionManager?: () => AreaSelectionManager;
  onEnter?: (ids: string[]) => void;
  onExit?: () => void;
  onSelectionChange?: (count: number) => void;
  hideSelectionOverlay?: () => void;
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
  private readonly snap: NodeSnapHelper;
  private deps: NodeEditDeps;
  private editingIds = new Set<string>();
  private drag: DragState | null = null;
  public isExtending = false;
  public readonly overlayEl: NodeEditOverlayElement;

  constructor(deps: NodeEditDeps) {
    this.deps = deps;
    this.overlayEl = deps.getOverlayElement();
    this.snap = new NodeSnapHelper(deps.camera, deps.getAllElements);

    this.session.onGeometryChange = (id): void => {
      this.applyBack(id);
      this.syncOverlay();
    };
    this.session.onSelectionChange = (): void => {
      this.syncOverlay();
      this.deps.onSelectionChange?.(this.session.getSelectedCount());
    };
  }

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

    const asm = this.deps.areaSelectionManager?.();
    if (asm && !asm.onNodeAreaSelect) {
      asm.onNodeAreaSelect = (rect, toggle) => {
        this.session.selectNodesInRect(rect.x, rect.y, rect.width, rect.height, toggle);
        asm.setGesture('click');
      };
      asm.onNodeLassoSelect = (points, toggle) => {
        this.session.selectNodesInLasso(points, toggle);
        asm.setGesture('click');
      };
    }

    const models = editable.map((el) => {
      el.isEditingNodes = true;
      if ('_suppressHitArea' in el) (el as PathElement)._suppressHitArea = true;
      return el.toEditModel();
    });
    this.editingIds = new Set(editable.map((el) => el.id));
    this.session.setTargets(models);
    this.deps.hideSelectionOverlay?.();
    this.syncOverlay();
    this.overlayEl.editing = true; // маркер для RenderScheduler
    this.deps.onEnter?.(Array.from(this.editingIds));
  }

  public exit(): void {
    if (this.session.isEmpty) return;
    this.isExtending = false;
    for (const id of this.editingIds) {
      const el = this.deps.getElement(id);
      if (el) {
        el.isEditingNodes = false;
        if ('_suppressHitArea' in el)
          (el as PathElement)._suppressHitArea = false;
        (el as PathElement).rebuildHitArea();
      }
    }
    this.editingIds.clear();
    this.session.clear();
    this.overlayEl.editing = false;
    this.overlayEl.selectedSegId = null;
    this.overlayEl.anchorRects = {};
    this.overlayEl.controlCircles = {};
    this.overlayEl.handleLines = {};
    this.overlayEl.segments = {};
    this.deps.restoreSelectionOverlay?.();
    this.drag = null;
    this.deps.onExit?.();
  }

  public onZoomChange(): void {
    if (this.isActive) this.syncOverlay();
  }

  private syncOverlay(): void {
    const targets = this.session.getTargets();
    const zoom = this.deps.camera.zoom;
    const z = zoom > 0 ? zoom : 1;
    const anchorSz = ANCHOR_PX / z;
    const half = anchorSz / 2;

    const anchors: typeof this.overlayEl.anchorRects = {};
    const controls: typeof this.overlayEl.controlCircles = {};
    const lines: typeof this.overlayEl.handleLines = {};
    const segs: typeof this.overlayEl.segments = {};

    for (const target of targets) {
      for (let contourIdx = 0; contourIdx < target.contours.length; contourIdx++) {
        const contour = target.contours[contourIdx];
        const n = contour.nodes.length;
        const segCount = contour.closed ? n : n - 1;
        for (let s = 0; s < segCount; s++) {
          const na = contour.nodes[s];
          const nb = contour.nodes[(s + 1) % n];
          const a = na.anchor;
          const b = nb.anchor;
          const seg: typeof segs[string] = {
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            closed: contour.closed,
            contourIdx,
          };
          if (na.handleOut || nb.handleIn) {
            const p0 = a;
            const p1 = na.handleOut ?? a;
            const p2 = nb.handleIn ?? b;
            const p3 = b;
            const pts: Point[] = [];
            const steps = 12;
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const mt = 1 - t;
              pts.push({
                x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
                y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
              });
            }
            seg.points = pts;
          }
          segs[`${contourIdx}-${s}`] = seg;
        }
        for (const node of contour.nodes) {
          const sel = target.selection.has(node.id);

          if (sel) {
            if (node.handleIn) {
              lines[`${node.id}-in`] = {
                x1: node.anchor.x,
                y1: node.anchor.y,
                x2: node.handleIn.x,
                y2: node.handleIn.y,
              };
              controls[`${node.id}-in`] = {
                cx: node.handleIn.x,
                cy: node.handleIn.y,
                r: CTRL_R_SCREEN / z,
              };
            }
            if (node.handleOut) {
              lines[`${node.id}-out`] = {
                x1: node.anchor.x,
                y1: node.anchor.y,
                x2: node.handleOut.x,
                y2: node.handleOut.y,
              };
              controls[`${node.id}-out`] = {
                cx: node.handleOut.x,
                cy: node.handleOut.y,
                r: CTRL_R_SCREEN / z,
              };
            }
          }

          anchors[node.id] = {
            x: node.anchor.x - half,
            y: node.anchor.y - half,
            w: anchorSz,
            h: anchorSz,
            kind:
              node.type === 'corner'
                ? 'corner'
                : node.type === 'symmetric'
                  ? 'symmetric'
                  : 'smooth',
            selected: sel,
          };
        }
      }
    }

    this.overlayEl.anchorRects = anchors;
    this.overlayEl.controlCircles = controls;
    this.overlayEl.handleLines = lines;
    this.overlayEl.segments = segs;
  }

  private applyBack(id: string): void {
    const el = this.deps.getElement(id);
    if (!el || !isNodeEditable(el)) return;
    const model = this.session.getModel(id);
    if (!model) return;

    let editable: INodeEditable = el;
    const needsPath = !el.supportsCurves && this.session.hasCurves(id);
    const multiContour = model.contours.length > 1 && (el.type === 'polygon' || el.type === 'polyline');
    if (needsPath || multiContour) {
      const path = this.deps.convertToPath(id);
      if (path) editable = path;
    }
    editable.applyEditModel(model);
  }

  public hitNode(worldX: number, worldY: number): NodeHit | null {
    const r = HIT_PX / this.deps.camera.zoom;
    return this.session.hitNode(worldX, worldY, r);
  }

  public get isDragging(): boolean {
    return this.drag !== null;
  }

  public pointerDown(worldPt: Point, ctrlKey = false): boolean {
    const hit = this.hitNode(worldPt.x, worldPt.y);
    if (hit) {
      this.overlayEl.selectedSegId = null;
      if (hit.part === 'anchor') {
        const t = this.session
          .getTargets()
          .find((x) => x.elementId === hit.elementId);
        const already = t?.selection.has(hit.nodeId);
        if (ctrlKey || this.session.multiSelectMode) {
          this.session.toggle(hit.elementId, hit.nodeId);
        } else if (!already) {
          this.session.selectSingle(hit.elementId, hit.nodeId);
        }
      }
      this.snap.buildTargets(this.editingIds, this.collectSnapNodes(hit));
      this.drag = { hit, last: { x: worldPt.x, y: worldPt.y }, moved: false };
      return true;
    }

    const segHit = this.hitSegment(worldPt.x, worldPt.y);
    if (segHit) {
      console.log('[pointerDown] segment hit, contourIdx:', segHit.contourIdx, 'segIdx:', segHit.segIdx);
      this.session.clearSelection();
      const segId = `${segHit.contourIdx}-${segHit.segIdx}`;
      this.overlayEl.selectedSegId = segId;
      this.deps.events.emit('SEGMENT_SELECTED', segHit);
      return true;
    }

    return false;
  }

  public hitSegment(worldX: number, worldY: number): {
    elementId: string;
    contourIdx: number;
    segIdx: number;
  } | null {
    const r = HIT_PX / (this.deps.camera.zoom > 0 ? this.deps.camera.zoom : 1);
    const r2 = r * r;
    let best: { elementId: string; contourIdx: number; segIdx: number } | null = null;
    let bestDist = Infinity;
    for (const target of this.session.getTargets()) {
      for (let contourIdx = 0; contourIdx < target.contours.length; contourIdx++) {
        const contour = target.contours[contourIdx];
        const n = contour.nodes.length;
        const segCount = contour.closed ? n : n - 1;
        for (let s = 0; s < segCount; s++) {
          const a = contour.nodes[s];
          const b = contour.nodes[(s + 1) % n];
          let dist: number;
          if (a.handleOut || b.handleIn) {
            dist = curveDist2(worldX, worldY, a.anchor, a.handleOut ?? a.anchor, b.handleIn ?? b.anchor, b.anchor);
          } else {
            const { dist: d } = pointToSegmentDist2(worldX, worldY, a.anchor.x, a.anchor.y, b.anchor.x, b.anchor.y);
            dist = d;
          }
          if (dist <= r2 && dist < bestDist) {
            bestDist = dist;
            best = { elementId: target.elementId, contourIdx, segIdx: s };
          }
        }
      }
    }
    return best;
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
      this.session.moveHandle(
        hit.elementId,
        hit.nodeId,
        hit.part,
        snapped.x,
        snapped.y,
      );
    }
  }

  public pointerUp(): void {
    if (!this.drag) return;
    this.drag = null;
    this.snap.reset();
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

  public insertAt(worldX: number, worldY: number): boolean {
    const maxD = 12000 / this.deps.camera.zoom;
    console.log('[insertAt] world:', worldX, worldY, 'maxD:', maxD, 'targets:', this.session.getTargetIds());
    let best: {
      elementId: string;
      contourIdx: number;
      segIdx: number;
      t: number;
      dist: number;
    } | null = null;

    for (const target of this.session.getTargets()) {
      const contours = target.contours;
      for (let contourIdx = 0; contourIdx < contours.length; contourIdx++) {
        const contour = contours[contourIdx];
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
      }
    }
    if (!best || best.dist > maxD) {
      console.log('[insertAt] no candidate or too far, best:', best, 'maxD:', maxD);
      return false;
    }
    console.log('[insertAt] inserting at segIdx:', best.segIdx, 'contourIdx:', best.contourIdx, 't:', best.t, 'dist:', best.dist);
    const nodeId = this.session.insertNode(
      best.elementId,
      best.contourIdx,
      best.segIdx,
      best.t,
    );
    if (nodeId) {
      this.session.selectSingle(best.elementId, nodeId);
      this.deps.events.emit('NODE_INSERTED', {
        elementId: best.elementId,
        nodeId,
        contourIdx: best.contourIdx,
        segIdx: best.segIdx,
      });
      return true;
    }
    return false;
  }

  public setMultiSelect(on: boolean): void {
    this.session.multiSelectMode = on;
  }
  public getMultiSelect(): boolean {
    return this.session.multiSelectMode;
  }
  public deleteSelected(): void {
    this.session.deleteSelected();
  }
  public setSelectedType(kind: NodeKind): void {
    this.session.setSelectedType(kind);
  }
  public smoothSelected(): void {
    this.session.smoothSelected();
  }
  public sharpenSelected(): void {
    this.session.sharpenSelected();
  }
  public distributeEvenly(): void {
    this.session.distributeSelectedEvenly();
  }
  public nudge(dx: number, dy: number): void {
    this.session.moveSelected(dx, dy);
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

  public setNodeType(elementId: string, nodeId: string, kind: NodeKind): void {
    this.session.setNodeType(elementId, nodeId, kind);
    this.deps.events.emit('NODE_TYPE_CHANGED', { elementId, nodeId, type: kind });
    this.syncOverlay();
  }

  public deleteSegment(elementId: string, contourIdx: number, segIdx: number): void {
    this.session.deleteSegment(elementId, contourIdx, segIdx);
    this.overlayEl.selectedSegId = null;
    this.deps.events.emit('SEGMENT_DELETED', { elementId, contourIdx, segIdx });
    this.syncOverlay();
  }

  public closePath(elementId: string, contourIdx: number, closed: boolean): void {
    this.session.closePathToggle(elementId, contourIdx);
    const contour = this.session.getTargets().find((t) => t.elementId === elementId)?.contours[contourIdx];
    this.deps.events.emit('PATH_CLOSED_CHANGED', {
      elementId,
      contourIdx,
      closed: contour?.closed ?? closed,
    });
    this.syncOverlay();
  }

  public connectNodes(elementId: string, nodeId1: string, nodeId2: string): void {
    this.session.connectNodes(elementId, nodeId1, nodeId2);
    this.deps.events.emit('NODES_CONNECTED', { elementId, nodeId1, nodeId2 });
    this.syncOverlay();
  }

  public extendStart(): void {
    this.isExtending = true;
    this.session.clearSelection();
    this.overlayEl.selectedSegId = null;
  }

  public extendStop(): void {
    const ch = this.deps.creationHandler?.();
    if (ch?.isActive) ch.finishMulti();
    if (ch) {
      ch.setActiveType(null);
      ch.editingPathElement = null;
    }
    this.isExtending = false;
    this.reloadTargets();
  }

  public reloadTargets(): void {
    const models = Array.from(this.editingIds)
      .map((id) => this.deps.getElement(id))
      .filter(isNodeEditable)
      .map((el) => el.toEditModel());
    if (models.length > 0) {
      this.session.setTargets(models);
      this.syncOverlay();
    }
  }

  public clickEmpty(): void {
    if (this.isExtending) return;
    if (!this.session.multiSelectMode) this.session.clearSelection();
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

function curveDist2(
  px: number, py: number,
  p0: Point, p1: Point, p2: Point, p3: Point,
): number {
  let best = Infinity;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const mt = 1 - t;
    const cx = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
    const cy = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
    const dx = px - cx;
    const dy = py - cy;
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return best;
}

function pointToSegmentDist2(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((x - ax) * dx + (y - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + dx * t;
  const py = ay + dy * t;
  const distX = x - px;
  const distY = y - py;
  return { dist: distX * distX + distY * distY };
}
