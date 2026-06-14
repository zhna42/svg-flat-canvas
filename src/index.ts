export { SvgCanvas } from '@/core';
export type { SvgCanvasOptions } from '@/types';
export type { Point, BoundingBox, ElementType, PathCommand } from '@/types';
export {
  RectElement,
  CircleElement,
  EllipseElement,
  LineElement,
  PathElement,
  PolygonElement,
  PolylineElement,
  TextElement,
  ImageElement,
  createFromJSON,
  createFromJSONArray,
} from '@/shapes';
export type { ElementJSON } from '@/shapes';
export type {
  SelectionMode,
  SelectionFilter,
  SelectionShortcuts,
} from '@/selection';
export type { Group, GroupData, GroupConflictAction } from '@/group';

export { CommandBus, CommandHistory } from '@/commands';
export type {
  Command,
  CommandType,
  SelectCommand,
  DragMoveCommand,
  DragEndCommand,
  SelectionGesture,
  CommandSnapshot,
  SnapshotEntry,
} from '@/commands';
export {
  createSelectPickCommand,
  createSelectRectCommand,
  createSelectLassoCommand,
  createDragMoveCommand,
  createDragEndCommand,
} from '@/commands';
