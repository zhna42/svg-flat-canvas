import type { Point, BoundingBox } from '@/types';

export type { Point, BoundingBox };

export interface HitTestableElement {
  readonly id: string;
  getTransformedBBox(): BoundingBox;
  getWorldHitPoints(): Point[];
}

export interface HitTestResult {
  hits: HitTestableElement[];
}

export interface QueryOptions {
  groupBy?: (elementId: string) => string | undefined;
  requireFullContain?: boolean;
  filter?: (element: HitTestableElement) => boolean;
}

export interface HitServiceResult {
  handler: string;
  data: unknown;
}

export interface ServiceHandler {
  name: string;
  priority: number;
  hitTest(x: number, y: number): HitServiceResult | null;
}

export interface CollisionResult {
  x: number;
  y: number;
}
