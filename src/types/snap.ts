import type { Point } from './index';

export type { Point };

export type SnapAxis = 'x' | 'y';

export interface AdaptiveSnapResult {
  correctionX: number;
  correctionY: number;
}

export interface TypedSnapResult {
  correctionX: number;
  correctionY: number;
  type: 'none' | 'point' | 'line' | 'curve';
  lineStartX?: number;
  lineStartY?: number;
  lineEndX?: number;
  lineEndY?: number;
}

export interface SnapLine {
  x: number;
  y: number;
  x2: number;
  y2: number;
  isOrthogonal: boolean;
}

export interface ScreenBezierSeg {
  p0x: number;
  p0y: number;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  p3x?: number;
  p3y?: number;
  type: 'cubic' | 'quadratic';
}

export interface CurveTarget {
  type: 'circle' | 'ellipse' | 'bezier';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  bezierSegs?: ScreenBezierSeg[];
}

export interface PointToSegmentResult {
  distSq: number;
  closestX: number;
  closestY: number;
  normalX: number;
  normalY: number;
  t: number;
}

export interface PointToEdgeSnapResult {
  distSq: number;
  snapX: number;
  snapY: number;
}

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
  grid: import('@/core/HitTestEngine').SpatialGrid;
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
