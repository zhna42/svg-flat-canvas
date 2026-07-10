import type { Point, PathCommand } from './index';

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
  | 'CREATE_FILE'
  | 'DELETE'
  | 'RESIZE'
  | 'ROTATE'
  | 'TRANSFORM'
  | 'GEOMETRY_MUTATE'
  | 'PATH_ADD_NODE'
  | 'PATH_CHANGE_NODE_TYPE'
  | 'PATH_REMOVE_NODE'
  | 'PATH_MOVE_SUBPATH'
  | 'BOOLEAN_OPERATION'
  | 'UPDATE';

export type SelectionMode = 'element' | 'group';
export type SelectionGesture = 'click' | 'rect' | 'lasso';

export type CreationElementType =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'path'
  | 'text';

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateCommand {
  type: 'CREATE';
  options: {
    element: import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement;
  };
}

export interface CreateFileCommand {
  type: 'CREATE_FILE';
  options: {
    elements: import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement[];
    groupId: string;
    groupName: string;
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
  options: { elementIds: string[]; mode?: string };
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

export interface GeometryMutateCommand {
  type: 'GEOMETRY_MUTATE';
  options: {
    id: string;
    newCommands: PathCommand[];
  };
}

export interface PathAddNodeCommand {
  type: 'PATH_ADD_NODE';
  options: {
    id: string;
    cmdIdx: number;
    x: number;
    y: number;
    t: number;
    prevEndX: number;
    prevEndY: number;
  };
}

export interface PathChangeNodeTypeCommand {
  type: 'PATH_CHANGE_NODE_TYPE';
  options: {
    id: string;
    cmdIdx: number;
    newType: 'L' | 'C';
  };
}

export interface PathRemoveNodeCommand {
  type: 'PATH_REMOVE_NODE';
  options: {
    id: string;
    cmdIdx: number;
  };
}

export interface PathMoveSubpathCommand {
  type: 'PATH_MOVE_SUBPATH';
  options: {
    id: string;
    subpathIdx: number;
    delta: Point;
  };
}

export interface BooleanOperationCommand {
  type: 'BOOLEAN_OPERATION';
  options: {
    subjectIds: string[];
    clipIds: string[];
    resultCommands: PathCommand[];
    resultFill: string;
    resultStroke: string;
  };
}

export type Command =
  | CreateCommand
  | CreateFileCommand
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
  | TransformCommand
  | GeometryMutateCommand
  | PathAddNodeCommand
  | PathChangeNodeTypeCommand
  | PathRemoveNodeCommand
  | PathMoveSubpathCommand
  | BooleanOperationCommand;

export type CommandHandler = (
  command: Command,
) => void | { affected: { kind: string; id: string }[] };

export interface CommandRegistry {
  [type: string]: CommandHandler;
}

export interface DragHandlerContext {
  getElements: () => import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement[];
  onDragEnd?: (elementIds: string[]) => void;
}

export interface SelectHandlerContext {
  state: import('@/canvas/overlays/selection/SelectionState').SelectionState;
  getElements: () => import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement[];
  hitTestEngine: import('@/core/HitTestEngine').HitTestEngine;
  lookupGroup: (elementId: string) => string | undefined;
}
