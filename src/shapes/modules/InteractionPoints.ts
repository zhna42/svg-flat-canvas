import type { Point, BoundingBox } from '@/types';
import type { HandlePosition } from '@/selection/overlay/SelectionOverlay';

export type { HandlePosition };

export class InteractionPoints {
  public getHandles(bbox: BoundingBox): Map<HandlePosition, Point> {
    const { x, y, width, height } = bbox;
    const cx = x + width / 2;
    const cy = y + height / 2;
    return new Map([
      ['e', { x: x + width, y: cy }],
      ['ne', { x: x + width, y }],
      ['n', { x: cx, y }],
      ['nw', { x, y }],
      ['w', { x, y: cy }],
      ['sw', { x, y: y + height }],
      ['s', { x: cx, y: y + height }],
      ['se', { x: x + width, y: y + height }],
    ]);
  }

  public getRotationHandle(bbox: BoundingBox, offset = 30): Point {
    return {
      x: bbox.x + bbox.width / 2,
      y: bbox.y - offset,
    };
  }
}
