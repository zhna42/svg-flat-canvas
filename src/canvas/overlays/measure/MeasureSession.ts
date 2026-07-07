import type {
  Point,
  MeasureTool,
  ProtractorMode,
  Measurement,
  DistanceMeasure,
  AngleMeasure,
  MeasureResult,
} from '@/types';
import { MM_TO_PX } from '@/constants';

let _measureIdSeq = 0;
function nextId(): string {
  _measureIdSeq += 1;
  return `m${_measureIdSeq}`;
}

/**
 * Модуль измерения (чистая логика, без DOM/камеры).
 * Хранит завершённые замеры и точки текущего (незавершённого) замера.
 */
export class MeasureSession {
  public tool: MeasureTool | null = null;
  public protractorMode: ProtractorMode = 'points';

  private measurements: Measurement[] = [];
  private pending: Point[] = [];

  /** Изменилось состояние (нужен re-render / событие). */
  public onChange: (() => void) | null = null;
  /** Добавлен завершённый замер. */
  public onAdded: ((m: Measurement) => void) | null = null;

  public setTool(tool: MeasureTool | null): void {
    this.tool = tool;
    this.pending = [];
    this.onChange?.();
  }

  public getMeasurements(): Measurement[] {
    return this.measurements;
  }

  public getPending(): Point[] {
    return this.pending;
  }

  public cancelPending(): void {
    if (this.pending.length === 0) return;
    this.pending = [];
    this.onChange?.();
  }

  public clearAll(): void {
    this.measurements = [];
    this.pending = [];
    this.onChange?.();
  }

  public remove(id: string): void {
    this.measurements = this.measurements.filter((m) => m.id !== id);
    this.onChange?.();
  }

  /** Добавить готовый замер (например, режим «между объектами»). */
  public addMeasurement(m: Measurement): void {
    this.measurements.push(m);
    this.onChange?.();
    this.onAdded?.(m);
  }

  /**
   * Добавить точку текущего замера.
   * Линейка завершается после 2 точек, транспортир — после 3.
   */
  public addPoint(p: Point): void {
    if (!this.tool) return;
    this.pending.push({ x: p.x, y: p.y });

    if (this.tool === 'ruler' && this.pending.length === 2) {
      const m: DistanceMeasure = {
        id: nextId(),
        kind: 'distance',
        a: this.pending[0],
        b: this.pending[1],
      };
      this.pending = [];
      this.addMeasurement(m);
      return;
    }
    if (this.tool === 'protractor' && this.pending.length === 3) {
      const m: AngleMeasure = {
        id: nextId(),
        kind: 'angle',
        p1: this.pending[0],
        vertex: this.pending[1],
        p2: this.pending[2],
      };
      this.pending = [];
      this.addMeasurement(m);
      return;
    }
    this.onChange?.();
  }

  public getResults(): MeasureResult[] {
    return this.measurements.map((m) => toResult(m));
  }

  public getResult(id: string): MeasureResult | null {
    const m = this.measurements.find((x) => x.id === id);
    return m ? toResult(m) : null;
  }
}

export function distanceMm(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / MM_TO_PX;
}

export function angleDeg(vertex: Point, p1: Point, p2: Point): number {
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let deg = ((a2 - a1) * 180) / Math.PI;
  deg = Math.abs(deg);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

function toResult(m: Measurement): MeasureResult {
  if (m.kind === 'distance') {
    return { id: m.id, kind: 'distance', distanceMm: distanceMm(m.a, m.b) };
  }
  return { id: m.id, kind: 'angle', angleDeg: angleDeg(m.vertex, m.p1, m.p2) };
}
