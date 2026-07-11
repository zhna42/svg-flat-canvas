import type { Point } from '@/core/type';
import type { DragMoveCommand, DragEndCommand, SelectionMode } from '../types';

export const createDragMoveCommand = (
  mode: SelectionMode,
  delta: Point,
  elementIds: string[],
): DragMoveCommand => ({
  type: 'DRAG_MOVE',
  options: { mode, delta, elementIds },
});

export const createDragEndCommand = (elementIds: string[]): DragEndCommand => ({
  type: 'DRAG_END',
  options: { elementIds },
});
