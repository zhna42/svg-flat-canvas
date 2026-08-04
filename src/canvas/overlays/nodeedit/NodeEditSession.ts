import type {
  Point,
  ElementType,
  EditNode,
  EditContour,
  EditNodeModel,
  NodeKind,
  NodeRef,
  NodeHit,
} from '@/core/type';
import { classifyNode, nextNodeId } from '@/core/shapes/path/node-model';

export interface EditTarget {
  elementId: string;
  elementType: ElementType;
  contours: EditContour[];
  selection: Set<string>;
}

interface NodeLocation {
  target: EditTarget;
  contour: EditContour;
  index: number;
  node: EditNode;
}

function vsub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
function vadd(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
function vscale(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s };
}
function vlen(a: Point): number {
  return Math.hypot(a.x, a.y);
}
function vnorm(a: Point): Point {
  const l = vlen(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/**
 * Модуль редактирования узлов. Не знает про DOM/камеру.
 * Оперирует несколькими независимыми целями в мировых координатах.
 */
export class NodeEditSession {
  private targets = new Map<string, EditTarget>();
  public multiSelectMode = false;

  /** Вызывается при любом изменении геометрии (нужен write-back в элемент). */
  public onGeometryChange: ((elementId: string) => void) | null = null;
  /** Вызывается при изменении выбора (нужен только re-render оверлея). */
  public onSelectionChange: (() => void) | null = null;

  // ── Targets ──

  public setTargets(models: EditNodeModel[]): void {
    this.targets.clear();
    for (const m of models) this.addTarget(m);
  }

  public addTarget(model: EditNodeModel): void {
    this.targets.set(model.elementId, {
      elementId: model.elementId,
      elementType: model.elementType,
      contours: model.contours,
      selection: new Set(),
    });
  }

  public removeTarget(elementId: string): void {
    this.targets.delete(elementId);
  }

  public clear(): void {
    this.targets.clear();
  }

  public get isEmpty(): boolean {
    return this.targets.size === 0;
  }

  public getTargets(): EditTarget[] {
    return Array.from(this.targets.values());
  }

  public getTargetIds(): string[] {
    return Array.from(this.targets.keys());
  }

  public getModel(elementId: string): EditNodeModel | null {
    const t = this.targets.get(elementId);
    if (!t) return null;
    return {
      elementId: t.elementId,
      elementType: t.elementType,
      contours: t.contours,
    };
  }

  public hasCurves(elementId: string): boolean {
    const t = this.targets.get(elementId);
    if (!t) return false;
    for (const c of t.contours)
      for (const n of c.nodes) if (n.handleIn || n.handleOut) return true;
    return false;
  }

  // ── Lookup ──

  private locate(elementId: string, nodeId: string): NodeLocation | null {
    const target = this.targets.get(elementId);
    if (!target) return null;
    for (const contour of target.contours) {
      const index = contour.nodes.findIndex((n) => n.id === nodeId);
      if (index >= 0) {
        return { target, contour, index, node: contour.nodes[index] };
      }
    }
    return null;
  }

  // ── Hit test (мировые координаты, радиус в мировых единицах) ──

  public hitNode(
    worldX: number,
    worldY: number,
    radius: number,
  ): NodeHit | null {
    const r2 = radius * radius;
    let best: NodeHit | null = null;
    let bestD = Infinity;
    for (const target of this.targets.values()) {
      const selected = target.selection;
      for (const contour of target.contours) {
        for (const node of contour.nodes) {
          // Ручки — только у выбранных узлов, и приоритетнее якорей.
          if (selected.has(node.id)) {
            if (node.handleIn) {
              const d = dist2(worldX, worldY, node.handleIn);
              if (d <= r2 && d < bestD) {
                bestD = d;
                best = {
                  elementId: target.elementId,
                  nodeId: node.id,
                  part: 'in',
                };
              }
            }
            if (node.handleOut) {
              const d = dist2(worldX, worldY, node.handleOut);
              if (d <= r2 && d < bestD) {
                bestD = d;
                best = {
                  elementId: target.elementId,
                  nodeId: node.id,
                  part: 'out',
                };
              }
            }
          }
        }
      }
    }
    if (best) return best;
    // Якоря
    for (const target of this.targets.values()) {
      for (const contour of target.contours) {
        for (const node of contour.nodes) {
          const d = dist2(worldX, worldY, node.anchor);
          if (d <= r2 && d < bestD) {
            bestD = d;
            best = {
              elementId: target.elementId,
              nodeId: node.id,
              part: 'anchor',
            };
          }
        }
      }
    }
    return best;
  }

  // ── Selection ──

  public handleClick(hit: NodeHit | null): void {
    if (!hit) {
      if (!this.multiSelectMode) this.clearSelection();
      return;
    }
    if (this.multiSelectMode) {
      this.toggle(hit.elementId, hit.nodeId);
    } else {
      this.selectSingle(hit.elementId, hit.nodeId);
    }
  }

  public selectSingle(elementId: string, nodeId: string): void {
    for (const t of this.targets.values()) t.selection.clear();
    this.targets.get(elementId)?.selection.add(nodeId);
    this.onSelectionChange?.();
  }

  public toggle(elementId: string, nodeId: string): void {
    const t = this.targets.get(elementId);
    if (!t) return;
    if (t.selection.has(nodeId)) t.selection.delete(nodeId);
    else t.selection.add(nodeId);
    this.onSelectionChange?.();
  }

  public clearSelection(): void {
    for (const t of this.targets.values()) t.selection.clear();
    this.onSelectionChange?.();
  }

  public selectAll(): void {
    for (const t of this.targets.values()) {
      t.selection.clear();
      for (const c of t.contours)
        for (const n of c.nodes) t.selection.add(n.id);
    }
    this.onSelectionChange?.();
  }

  public invertSelection(): void {
    for (const t of this.targets.values()) {
      for (const c of t.contours)
        for (const n of c.nodes) {
          if (t.selection.has(n.id)) t.selection.delete(n.id);
          else t.selection.add(n.id);
        }
    }
    this.onSelectionChange?.();
  }

  public selectNodesInRect(
    x: number,
    y: number,
    w: number,
    h: number,
    toggle: boolean,
  ): void {
    if (!toggle) {
      for (const t of this.targets.values()) t.selection.clear();
    }
    for (const t of this.targets.values()) {
      for (const c of t.contours) {
        for (const n of c.nodes) {
          const ax = n.anchor.x;
          const ay = n.anchor.y;
          if (ax >= x && ax <= x + w && ay >= y && ay <= y + h) {
            t.selection.add(n.id);
          }
        }
      }
    }
    this.onSelectionChange?.();
  }

  public selectNodesInLasso(
    points: { x: number; y: number }[],
    toggle: boolean,
  ): void {
    if (!toggle) {
      for (const t of this.targets.values()) t.selection.clear();
    }
    for (const t of this.targets.values()) {
      for (const c of t.contours) {
        for (const n of c.nodes) {
          if (pointInPolygon(n.anchor.x, n.anchor.y, points)) {
            t.selection.add(n.id);
          }
        }
      }
    }
    this.onSelectionChange?.();
  }

  public getSelectedRefs(): NodeRef[] {
    const refs: NodeRef[] = [];
    for (const t of this.targets.values())
      for (const id of t.selection)
        refs.push({ elementId: t.elementId, nodeId: id });
    return refs;
  }

  public getSelectedCount(): number {
    let n = 0;
    for (const t of this.targets.values()) n += t.selection.size;
    return n;
  }

  public getNodeAnchor(elementId: string, nodeId: string): Point | null {
    const loc = this.locate(elementId, nodeId);
    return loc ? { x: loc.node.anchor.x, y: loc.node.anchor.y } : null;
  }

  private forEachSelected(fn: (loc: NodeLocation) => void): Set<string> {
    const touched = new Set<string>();
    for (const t of this.targets.values()) {
      for (const id of Array.from(t.selection)) {
        const loc = this.locate(t.elementId, id);
        if (loc) {
          fn(loc);
          touched.add(t.elementId);
        }
      }
    }
    return touched;
  }

  private emitGeometry(ids: Set<string>): void {
    for (const id of ids) this.onGeometryChange?.(id);
  }

  // ── Move (world deltas) ──

  public moveNode(
    elementId: string,
    nodeId: string,
    dx: number,
    dy: number,
  ): void {
    const loc = this.locate(elementId, nodeId);
    if (!loc) return;
    shiftNode(loc.node, dx, dy);
    this.onGeometryChange?.(elementId);
  }

  public moveSelected(dx: number, dy: number): void {
    const ids = this.forEachSelected((loc) => shiftNode(loc.node, dx, dy));
    this.emitGeometry(ids);
  }

  /** Тянуть ручку узла с учётом типа (связная логика). */
  public moveHandle(
    elementId: string,
    nodeId: string,
    part: 'in' | 'out',
    worldX: number,
    worldY: number,
  ): void {
    const loc = this.locate(elementId, nodeId);
    if (!loc) return;
    const node = loc.node;
    const target: Point = { x: worldX, y: worldY };
    if (part === 'in') node.handleIn = target;
    else node.handleOut = target;

    const opposite = part === 'in' ? 'out' : 'in';
    const oppVal = opposite === 'in' ? node.handleIn : node.handleOut;

    if (node.type === 'symmetric') {
      const mirror = vsub(vscale(node.anchor, 2), target);
      if (opposite === 'in') node.handleIn = mirror;
      else node.handleOut = mirror;
    } else if (node.type === 'smooth' && oppVal) {
      const oppLen = vlen(vsub(oppVal, node.anchor));
      const dir = vnorm(vsub(node.anchor, target));
      const mirror = vadd(node.anchor, vscale(dir, oppLen));
      if (opposite === 'in') node.handleIn = mirror;
      else node.handleOut = mirror;
    }
    this.onGeometryChange?.(elementId);
  }

  // ── Node type ──

  public setSelectedType(kind: NodeKind): void {
    const ids = this.forEachSelected((loc) => applyNodeKind(loc, kind));
    this.emitGeometry(ids);
  }

  public smoothSelected(): void {
    const ids = this.forEachSelected((loc) => applyNodeKind(loc, 'smooth'));
    this.emitGeometry(ids);
  }

  public sharpenSelected(): void {
    const ids = this.forEachSelected((loc) => applyNodeKind(loc, 'corner'));
    this.emitGeometry(ids);
  }

  // ── Delete ──

  public deleteSelected(): void {
    const touched = new Set<string>();
    for (const t of this.targets.values()) {
      if (t.selection.size === 0) continue;
      for (const contour of t.contours) {
        contour.nodes = contour.nodes.filter((n) => !t.selection.has(n.id));
      }
      t.contours = t.contours.filter(
        (c) => c.nodes.length >= 2 || (!c.closed && c.nodes.length >= 1),
      );
      t.selection.clear();
      touched.add(t.elementId);
    }
    this.emitGeometry(touched);
    this.onSelectionChange?.();
  }

  public splitSelected(): EditContour | null {
    const extracted: EditNode[] = [];
    const touched = new Set<string>();
    for (const t of this.targets.values()) {
      if (t.selection.size === 0) continue;
      for (const contour of t.contours) {
        const kept: EditNode[] = [];
        for (const node of contour.nodes) {
          if (t.selection.has(node.id)) extracted.push(node);
          else kept.push(node);
        }
        contour.nodes = kept;
      }
      t.contours = t.contours.filter(
        (c) => c.nodes.length >= 2 || (!c.closed && c.nodes.length >= 1),
      );
      t.selection.clear();
      touched.add(t.elementId);
    }
    if (extracted.length === 0) return null;
    this.emitGeometry(touched);
    this.onSelectionChange?.();
    return { nodes: extracted, closed: false };
  }

  // ── Distribute selected evenly along their chord ──

  public distributeSelectedEvenly(): void {
    const touched = new Set<string>();
    for (const t of this.targets.values()) {
      if (t.selection.size < 3) continue;
      for (const contour of t.contours) {
        const sel = contour.nodes.filter((n) => t.selection.has(n.id));
        if (sel.length < 3) continue;
        const first = sel[0].anchor;
        const last = sel[sel.length - 1].anchor;
        const steps = sel.length - 1;
        for (let i = 1; i < steps; i++) {
          const nx = first.x + ((last.x - first.x) * i) / steps;
          const ny = first.y + ((last.y - first.y) * i) / steps;
          const node = sel[i];
          const d = { x: nx - node.anchor.x, y: ny - node.anchor.y };
          shiftNode(node, d.x, d.y);
        }
        touched.add(t.elementId);
      }
    }
    this.emitGeometry(touched);
  }

  // ── Single node type change ──

  public setNodeType(elementId: string, nodeId: string, kind: NodeKind): void {
    const loc = this.locate(elementId, nodeId);
    if (!loc) return;
    applyNodeKind(loc, kind);
    this.emitGeometry(new Set([elementId]));
  }

  // ── Delete segment (splits contour) ──

  public deleteSegment(
    elementId: string,
    contourIdx: number,
    segIdx: number,
  ): void {
    const target = this.targets.get(elementId);
    if (!target) return;
    const contour = target.contours[contourIdx];
    if (!contour) return;
    const n = contour.nodes.length;
    const minNodes = contour.closed ? 2 : 1;
    if (n <= minNodes) return;
    const after = contour.nodes.slice(segIdx + 1);
    contour.nodes = contour.nodes.slice(0, segIdx + 1);
    contour.closed = false;
    target.contours.splice(contourIdx + 1, 0, {
      nodes: after,
      closed: false,
    });
    target.selection.clear();
    this.emitGeometry(new Set([elementId]));
    this.onSelectionChange?.();
  }

  // ── Toggle close path ──

  public closePathToggle(elementId: string, contourIdx: number): void {
    const target = this.targets.get(elementId);
    if (!target) return;
    const contour = target.contours[contourIdx];
    if (!contour) return;
    contour.closed = !contour.closed;
    this.emitGeometry(new Set([elementId]));
  }

  // ── Connect two nodes ──

  public connectNodes(
    elementId: string,
    nodeId1: string,
    nodeId2: string,
  ): void {
    const target = this.targets.get(elementId);
    if (!target) return;
    let contour: EditContour | undefined;
    let idx1 = -1;
    let idx2 = -1;
    for (const c of target.contours) {
      idx1 = c.nodes.findIndex((n) => n.id === nodeId1);
      idx2 = c.nodes.findIndex((n) => n.id === nodeId2);
      if (idx1 !== -1 && idx2 !== -1) {
        contour = c;
        break;
      }
    }
    if (!contour || idx1 === -1 || idx2 === -1) return;
    if (Math.abs(idx1 - idx2) <= 1) return;
    const a = contour.nodes[idx1];
    const b = contour.nodes[idx2];
    a.handleOut = undefined;
    b.handleIn = undefined;
    a.type = 'corner';
    b.type = 'corner';
    if (idx1 > idx2) {
      contour.nodes.splice(idx2 + 1, idx1 - idx2 - 1);
    } else {
      contour.nodes.splice(idx1 + 1, idx2 - idx1 - 1);
    }
    this.emitGeometry(new Set([elementId]));
    this.onSelectionChange?.();
  }

  // ── Insert node on a segment ──

  public insertNode(
    elementId: string,
    contourIdx: number,
    segIdx: number,
    t: number,
  ): string | null {
    const target = this.targets.get(elementId);
    if (!target) return null;
    const contour = target.contours[contourIdx];
    if (!contour) return null;
    const n = contour.nodes.length;
    const a = contour.nodes[segIdx];
    const b = contour.nodes[(segIdx + 1) % n];
    if (!a || !b) return null;

    const isCurve = !!(a.handleOut || b.handleIn);
    let newNode: EditNode;
    if (isCurve) {
      const p0 = a.anchor;
      const p1 = a.handleOut ?? a.anchor;
      const p2 = b.handleIn ?? b.anchor;
      const p3 = b.anchor;
      const s = splitCubic(p0, p1, p2, p3, t);
      a.handleOut = s.aOut;
      b.handleIn = s.bIn;
      newNode = {
        id: nextNodeId(),
        anchor: s.point,
        handleIn: s.inH,
        handleOut: s.outH,
        type: 'smooth',
      };
    } else {
      const p0 = a.anchor;
      const p3 = b.anchor;
      newNode = {
        id: nextNodeId(),
        anchor: { x: p0.x + (p3.x - p0.x) * t, y: p0.y + (p3.y - p0.y) * t },
        type: 'corner',
      };
    }
    contour.nodes.splice(segIdx + 1, 0, newNode);
    this.onGeometryChange?.(elementId);
    return newNode.id;
  }
}

function dist2(x: number, y: number, p: Point): number {
  const dx = x - p.x;
  const dy = y - p.y;
  return dx * dx + dy * dy;
}

function shiftNode(node: EditNode, dx: number, dy: number): void {
  node.anchor = { x: node.anchor.x + dx, y: node.anchor.y + dy };
  if (node.handleIn)
    node.handleIn = { x: node.handleIn.x + dx, y: node.handleIn.y + dy };
  if (node.handleOut)
    node.handleOut = { x: node.handleOut.x + dx, y: node.handleOut.y + dy };
}

function applyNodeKind(loc: NodeLocation, kind: NodeKind): void {
  const { node, contour, index } = loc;
  if (kind === 'corner') {
    delete node.handleIn;
    delete node.handleOut;
    node.type = 'corner';
    return;
  }
  // smooth / symmetric — синтезировать ручки по касательной соседей
  const n = contour.nodes.length;
  const prev = contour.closed
    ? contour.nodes[(index - 1 + n) % n]
    : contour.nodes[index - 1];
  const next = contour.closed
    ? contour.nodes[(index + 1) % n]
    : contour.nodes[index + 1];

  let tangent: Point;
  if (prev && next) tangent = vsub(next.anchor, prev.anchor);
  else if (next) tangent = vsub(next.anchor, node.anchor);
  else if (prev) tangent = vsub(node.anchor, prev.anchor);
  else tangent = { x: 1, y: 0 };
  const dir = vnorm(tangent);

  const lenIn = prev ? vlen(vsub(node.anchor, prev.anchor)) / 3 : 40;
  const lenOut = next ? vlen(vsub(next.anchor, node.anchor)) / 3 : 40;

  if (kind === 'symmetric') {
    const l = Math.max((lenIn + lenOut) / 2, 1);
    node.handleIn = vadd(node.anchor, vscale(dir, -l));
    node.handleOut = vadd(node.anchor, vscale(dir, l));
    node.type = 'symmetric';
  } else {
    node.handleIn = vadd(node.anchor, vscale(dir, -Math.max(lenIn, 1)));
    node.handleOut = vadd(node.anchor, vscale(dir, Math.max(lenOut, 1)));
    node.type = 'smooth';
  }
  node.type = classifyNode(node) === 'corner' ? kind : node.type;
}

function splitCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): { aOut: Point; bIn: Point; inH: Point; outH: Point; point: Point } {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const a = lerp(p0, p1);
  const b = lerp(p1, p2);
  const c = lerp(p2, p3);
  const d = lerp(a, b);
  const e = lerp(b, c);
  const f = lerp(d, e);
  return { aOut: a, inH: d, point: f, outH: e, bIn: c };
}

function pointInPolygon(
  px: number,
  py: number,
  poly: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}
