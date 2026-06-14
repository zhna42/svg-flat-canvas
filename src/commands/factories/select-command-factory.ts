import type { Point } from '@/types';
import type { SelectCommand, SelectionMode } from '../types';

export function createSelectPickCommand(
  mode: SelectionMode,
  point: Point,
  toggle: boolean,
): SelectCommand {
  return {
    type: 'SELECT',
    options: { mode, gesture: 'click', point, toggle },
  };
}

export function createSelectRectCommand(
  mode: SelectionMode,
  rect: { x: number; y: number; width: number; height: number },
  toggle: boolean,
  boxDirection: 'left-to-right' | 'right-to-left' = 'left-to-right',
): SelectCommand {
  return {
    type: 'SELECT',
    options: { mode, gesture: 'rect', rect, toggle, boxDirection },
  };
}

export function createSelectLassoCommand(
  mode: SelectionMode,
  lassoPoints: Point[],
  toggle: boolean,
): SelectCommand {
  return {
    type: 'SELECT',
    options: { mode, gesture: 'lasso', lassoPoints, toggle },
  };
}
