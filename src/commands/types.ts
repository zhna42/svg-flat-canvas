import type { Point } from '@/types';

export type CommandType = 'SELECT' | 'DRAG_MOVE' | 'DRAG_END';

export type SelectionMode = 'element' | 'group';
export type SelectionGesture = 'click' | 'rect' | 'lasso';

export interface SelectCommand {
  type: 'SELECT';
  options: {
    mode: SelectionMode;
    gesture: SelectionGesture;
    point?: Point;
    rect?: { x: number; y: number; width: number; height: number };
    lassoPoints?: Point[];
    toggle: boolean;
    boxDirection?: 'left-to-right' | 'right-to-left';
  };
}

export interface DragMoveCommand {
  type: 'DRAG_MOVE';
  options: {
    mode: SelectionMode;
    delta: Point;
    elementIds: string[];
  };
}

export interface DragEndCommand {
  type: 'DRAG_END';
  options: {
    elementIds: string[];
  };
}

export type Command = SelectCommand | DragMoveCommand | DragEndCommand;

export interface SnapshotEntry {
  id: string;
  properties: Record<string, unknown>;
}

export interface CommandSnapshot {
  type: CommandType;
  before: SnapshotEntry[];
  after: SnapshotEntry[];
}
