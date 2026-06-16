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
  HandlePosition,
  TransformMode,
} from '@/selection';
export { TransformHandler } from '@/selection';
export type { Group, GroupData, GroupConflictAction } from '@/group';
export { CommandBus } from '@/commands';
export type {
  Command,
  CommandType,
  SelectCommand,
  DragMoveCommand,
  DragEndCommand,
  GroupCreateCommand,
  GroupDeleteCommand,
  GroupAddCommand,
  GroupRemoveCommand,
  GroupClearCommand,
  DeleteCommand,
  ResizeCommand,
  RotateCommand,
  TransformCommand,
  BBox,
  SelectionGesture,
} from '@/commands';
export { TimeMachine } from '@/time-machine';
export type { TimeMachineRecord } from '@/time-machine';
export type { EntityKind } from '@/time-machine/types';
