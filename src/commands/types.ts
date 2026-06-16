import type { Point } from '@/types';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export type CommandType =
  | 'SELECT'
  | 'DRAG_MOVE'
  | 'DRAG_END'
  | 'GROUP_CREATE'
  | 'GROUP_DELETE'
  | 'GROUP_ADD'
  | 'GROUP_REMOVE'
  | 'GROUP_CLEAR'
  | 'CREATE'
  | 'DELETE'
  | 'RESIZE'
  | 'ROTATE'
  | 'TRANSFORM';

export type SelectionMode = 'element' | 'group';
export type SelectionGesture = 'click' | 'rect' | 'lasso';

export type CreationElementType =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon';

export interface CreateCommand {
  type: 'CREATE';
  options: {
    element: AbstractGraphicElement;
  };
}

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
  options: { mode: SelectionMode; delta: Point; elementIds: string[] };
}

export interface DragEndCommand {
  type: 'DRAG_END';
  options: { elementIds: string[] };
}

export interface GroupCreateCommand {
  type: 'GROUP_CREATE';
  options: { name?: string };
}

export interface GroupDeleteCommand {
  type: 'GROUP_DELETE';
  options: { groupId: string };
}

export interface GroupAddCommand {
  type: 'GROUP_ADD';
  options: { groupId: string; elementIds: string[] };
}

export interface GroupRemoveCommand {
  type: 'GROUP_REMOVE';
  options: { groupId: string; elementIds: string[] };
}

export interface GroupClearCommand {
  type: 'GROUP_CLEAR';
  options: { groupId: string };
}

export interface DeleteCommand {
  type: 'DELETE';
  options: { elementIds: string[] };
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeCommand {
  type: 'RESIZE';
  options: { elementIds: string[]; bbox: BBox };
}

export interface RotateCommand {
  type: 'ROTATE';
  options: { elementIds: string[]; angle: number };
}

export interface TransformCommand {
  type: 'TRANSFORM';
  options: {
    elementIds: string[];
    matrix: [number, number, number, number, number, number];
  };
}

export type Command =
  | CreateCommand
  | SelectCommand
  | DragMoveCommand
  | DragEndCommand
  | GroupCreateCommand
  | GroupDeleteCommand
  | GroupAddCommand
  | GroupRemoveCommand
  | GroupClearCommand
  | DeleteCommand
  | ResizeCommand
  | RotateCommand
  | TransformCommand;
