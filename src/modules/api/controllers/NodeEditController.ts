import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { PathElement } from '@/core/shapes/elements/PathElement';
import { PathElement as PathElementCtor } from '@/core/shapes/elements/PathElement';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { NodeKind } from '@/core/type';
import type { NodeEditSession } from '@/canvas/overlays/nodeedit/NodeEditSession';

export class NodeEditController {
  constructor(private canvas: SvgCanvas) {}

  get session(): NodeEditSession {
    return this.canvas.nodeEdit.session;
  }

  enterNodeEdit(ids: string[]): void {
    const els = ids
      .map((id) => this.canvas.shapeManager.getById(id))
      .filter((e): e is AbstractGraphicElement => !!e);
    if (els.length > 0) this.canvas.nodeEdit.enter(els);
  }

  exitNodeEdit(): void {
    this.canvas.nodeEdit.exit();
  }

  get isNodeEditing(): boolean {
    return this.canvas.nodeEdit.isActive;
  }

  setNodeMultiSelect(on: boolean): void {
    this.canvas.nodeEdit.setMultiSelect(on);
  }

  getNodeMultiSelect(): boolean {
    return this.canvas.nodeEdit.getMultiSelect();
  }

  setSelectedNodesType(kind: NodeKind): void {
    this.canvas.nodeEdit.setSelectedType(kind);
  }

  smoothSelectedNodes(): void {
    this.canvas.nodeEdit.smoothSelected();
  }

  sharpenSelectedNodes(): void {
    this.canvas.nodeEdit.sharpenSelected();
  }

  deleteSelectedNodes(): void {
    this.canvas.nodeEdit.deleteSelected();
  }

  distributeSelectedNodesEvenly(): void {
    this.canvas.nodeEdit.distributeEvenly();
  }

  nudgeSelectedNodes(dx: number, dy: number): void {
    this.canvas.nodeEdit.nudge(dx, dy);
  }

  selectAllNodes(): void {
    this.canvas.nodeEdit.selectAll();
  }

  clearNodeSelection(): void {
    this.canvas.nodeEdit.clearSelection();
  }

  invertNodeSelection(): void {
    this.canvas.nodeEdit.invertSelection();
  }

  getSelectedNodeCount(): number {
    return this.canvas.nodeEdit.getSelectedCount();
  }

  setNodeType(elementId: string, nodeId: string, kind: NodeKind): void {
    this.canvas.nodeEdit.setNodeType(elementId, nodeId, kind);
  }

  getSelectedNodeRefs(): Array<{ elementId: string; nodeId: string }> {
    return this.canvas.nodeEdit.session.getSelectedRefs();
  }

  deleteSegment(elementId: string, contourIdx: number, segIdx: number): void {
    this.canvas.nodeEdit.deleteSegment(elementId, contourIdx, segIdx);
  }

  closePath(elementId: string, contourIdx: number, closed: boolean): void {
    this.canvas.nodeEdit.closePath(elementId, contourIdx, closed);
  }

  isPathClosed(elementId: string, contourIdx: number): boolean {
    const target = this.canvas.nodeEdit.session
      .getTargets()
      .find((t) => t.elementId === elementId);
    return target?.contours[contourIdx]?.closed ?? false;
  }

  connectNodes(elementId: string, nodeId1: string, nodeId2: string): void {
    this.canvas.nodeEdit.connectNodes(elementId, nodeId1, nodeId2);
  }

  extendPathStart(): void {
    this.canvas.nodeEdit.extendStart();
  }

  extendPathStop(): void {
    this.canvas.nodeEdit.extendStop();
  }

  get isExtendingPath(): boolean {
    return this.canvas.nodeEdit.isExtending;
  }

  undoNodeEdit(): void {
    this.canvas.timeMachine.undo();
  }

  redoNodeEdit(): void {
    this.canvas.timeMachine.redo();
  }

  getElementPath(id: string): string | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return null;
    const props = (
      el as unknown as { getRenderGeometry: () => Record<string, unknown> }
    ).getRenderGeometry();
    return (props.d as string) ?? (props.points as string) ?? null;
  }

  setElementPath(id: string, d: string): void {
    const el = this.canvas.shapeManager.getById(id);
    if (el && el instanceof PathElementCtor) {
      (el as PathElement).d = d;
    }
  }

  get editingPath(): PathElement | null {
    const ids = this.canvas.nodeEdit.session.getTargetIds();
    for (const id of ids) {
      const el = this.canvas.shapeManager.getById(id);
      if (el instanceof PathElementCtor) return el as PathElement;
    }
    return null;
  }

  set editingPath(path: PathElement | null) {
    if (path) this.canvas.nodeEdit.enter([path]);
    else this.canvas.nodeEdit.exit();
  }
}
