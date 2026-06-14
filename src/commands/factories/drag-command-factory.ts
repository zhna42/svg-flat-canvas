import type { Point } from '@/types';
import type { DragMoveCommand, DragEndCommand, SelectionMode } from '../types';

export function createDragMoveCommand(
  mode: SelectionMode,
  delta: Point,
  elementIds: string[],
): DragMoveCommand {
  return {
    type: 'DRAG_MOVE',
    options: { mode, delta, elementIds },
  };
}

export function createDragEndCommand(
  elementIds: string[],
): DragEndCommand {
  return {
    type: 'DRAG_END',
    options: { elementIds },
  };
}
