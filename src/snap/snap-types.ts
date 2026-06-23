import type { Point } from '@/types';

export type { Point };

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export type SnapType = 'vertex' | 'edge' | 'center' | 'quadrant';

export interface AxisLock {
  lockX: boolean;
  lockY: boolean;
}

export interface BezierSegment {
  type: 'cubic' | 'quadratic' | 'line';
  p0: Point;
  p1: Point;
  p2?: Point;
  p3?: Point;
}

export interface EdgeInfo {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface AdvancedHitArea {
  bounds: BoundingBox;
  strokeWidth: number;
  strokeAlignment: 'center' | 'inside' | 'outside';
  vertices: Point[];
  edges: EdgeInfo[];
  shapeType: 'rect' | 'circle' | 'ellipse' | 'bezier' | 'polygon';
  shapeData: unknown;
}

export interface CADElement {
  id: string;
  groupId?: string;
  getHitArea(): AdvancedHitArea;
}

export interface CustomGuideline {
  type: 'horizontal' | 'vertical';
  value: number;
}

export interface SnapConstraint {
  type: 'none' | 'point' | 'line';
  snapX: number;
  snapY: number;
  lineAx?: number;
  lineAy?: number;
  lineBx?: number;
  lineBy?: number;
}

export interface SnapAccumulatorState {
  constraint: SnapConstraint;
}

export interface SnapGuideline {
  type: 'horizontal' | 'vertical';
  value: number;
  from: Point;
  to: Point;
}

export interface SnapConfig {
  mode: 'element' | 'group';
  movingElements: CADElement[];
  groupBounds?: BoundingBox;
  grid: import('@/spatial/SpatialGrid').SpatialGrid;
  getElementById: (id: string) => CADElement | undefined;
  camera: Camera;
  currentMouseWorld: Point;
  accumulatorState: SnapAccumulatorState;
  screenSnapRadius: number;
  screenDetachThreshold: number;
  axisLock: AxisLock;
  snapToCorners: boolean;
  snapToPlanes: boolean;
  snapToCanvas: boolean;
  canvasBounds?: BoundingBox;
  customGuidelines: CustomGuideline[];
}

export interface SnapResult {
  delta: Point;
  constraint: SnapConstraint;
  guidelines: SnapGuideline[];
}

export type SnapResultType = 'none' | 'node' | 'curve' | 'canvas' | 'guideline';
