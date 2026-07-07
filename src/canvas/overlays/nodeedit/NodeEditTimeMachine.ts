import type { EditContour } from '@/types';
import type { NodeEditSession } from './NodeEditSession';

interface TargetSnapshot {
  elementId: string;
  contours: EditContour[];
}

function cloneContours(contours: EditContour[]): EditContour[] {
  return contours.map((c) => ({
    closed: c.closed,
    nodes: c.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      anchor: { x: n.anchor.x, y: n.anchor.y },
      handleIn: n.handleIn ? { x: n.handleIn.x, y: n.handleIn.y } : undefined,
      handleOut: n.handleOut
        ? { x: n.handleOut.x, y: n.handleOut.y }
        : undefined,
    })),
  }));
}

/**
 * Локальная машина времени редактирования узлов.
 * Хранит снимки моделей ВСЕХ целей; шаг = замена контуров и write-back.
 */
export class NodeEditTimeMachine {
  private session: NodeEditSession;
  private applyBack: (elementId: string) => void;
  private records: TargetSnapshot[][] = [];
  private index = -1;

  constructor(
    session: NodeEditSession,
    applyBack: (elementId: string) => void,
  ) {
    this.session = session;
    this.applyBack = applyBack;
    this.capture();
  }

  public get canUndo(): boolean {
    return this.index > 0;
  }
  public get canRedo(): boolean {
    return this.index < this.records.length - 1;
  }

  public capture(): void {
    const snapshot = this.session.getTargets().map((t) => ({
      elementId: t.elementId,
      contours: cloneContours(t.contours),
    }));
    this.records.splice(
      this.index + 1,
      this.records.length - this.index - 1,
      snapshot,
    );
    this.index = this.records.length - 1;
  }

  public undo(): void {
    if (!this.canUndo) return;
    this.index--;
    this.apply();
  }

  public redo(): void {
    if (!this.canRedo) return;
    this.index++;
    this.apply();
  }

  private apply(): void {
    const snapshot = this.records[this.index];
    for (const snap of snapshot) {
      const target = this.session
        .getTargets()
        .find((t) => t.elementId === snap.elementId);
      if (target) {
        target.contours = cloneContours(snap.contours);
        this.applyBack(snap.elementId);
      }
    }
  }

  public clear(): void {
    this.records = [];
    this.index = -1;
  }
}
