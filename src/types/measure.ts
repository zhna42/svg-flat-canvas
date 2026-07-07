import type { Point } from './geometry';

/** Активный инструмент измерения. */
export type MeasureTool = 'ruler' | 'protractor';

/** Режим транспортира: по трём точкам или между двумя объектами. */
export type ProtractorMode = 'points' | 'objects';

export interface DistanceMeasure {
  id: string;
  kind: 'distance';
  a: Point;
  b: Point;
}

export interface AngleMeasure {
  id: string;
  kind: 'angle';
  vertex: Point;
  p1: Point;
  p2: Point;
}

export type Measurement = DistanceMeasure | AngleMeasure;

/** Результат замера для внешнего API. */
export interface MeasureResult {
  id: string;
  kind: 'distance' | 'angle';
  distanceMm?: number;
  angleDeg?: number;
}
