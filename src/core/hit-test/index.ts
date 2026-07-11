export { HitTestEngine } from './HitTestEngine';
export type { CollisionResult } from './HitTestEngine';
export { checkSceneCollisions } from './CollisionDetection';
export type { CollisionContext } from './CollisionDetection';
export { SpatialStore } from './SpatialStore';
export { SpatialGrid } from './SpatialGrid';
export { BBoxCache } from './BBoxCache';
export { HitAreaCache } from './HitAreaCache';
export { ServiceHitRegistry } from './ServiceHitRegistry';
export {
  pointInPolygon,
  rectContainsPoly,
  rectIntersectsPoly,
  polyInPoly,
  segmentIntersectsSegment,
  polyIntersectsPoly,
} from './PreciseHitTest';
export type {
  HitTestableElement,
  HitTestResult,
  QueryOptions,
  HitServiceResult,
  ServiceHandler,
} from './types';
