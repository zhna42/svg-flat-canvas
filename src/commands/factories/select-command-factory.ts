import type { Point } from '@/types';
import type { SelectCommand, SelectionMode } from '../types';

export const createSelectPickCommand = (
  mode: SelectionMode,
  point: Point,
  toggle: boolean,
): SelectCommand => ({
  type: 'SELECT',
  options: { mode, gesture: 'click', point, toggle },
});

export const createSelectRectCommand = (
  mode: SelectionMode,
  rect: { x: number; y: number; width: number; height: number },
  toggle: boolean,
  boxDirection: 'left-to-right' | 'right-to-left' = 'left-to-right',
): SelectCommand => ({
  type: 'SELECT',
  options: { mode, gesture: 'rect', rect, toggle, boxDirection },
});

export const createSelectLassoCommand = (
  mode: SelectionMode,
  lassoPoints: Point[],
  toggle: boolean,
): SelectCommand => ({
  type: 'SELECT',
  options: { mode, gesture: 'lasso', lassoPoints, toggle },
});
