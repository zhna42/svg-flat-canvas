export { ExternalApi } from '@/api';
export type {
  CreateShapeDTO,
  UpdateShapesDTO,
  DeleteShapesDTO,
  MoveShapesDTO,
  RotateShapesDTO,
  ResizeShapesDTO,
  SetTransformShapesDTO,
  GroupCreateDTO,
  GroupDeleteDTO,
  GroupAddElementsDTO,
  GroupRemoveElementsDTO,
  SelectShapesDTO,
  ClearSelectionDTO,
  SortShapesDTO,
  StyleDTO,
  TransformDTO,
  ElementGeometryDTO,
  RectGeometryDTO,
  CircleGeometryDTO,
  EllipseGeometryDTO,
  LineGeometryDTO,
  PathGeometryDTO,
  PolygonGeometryDTO,
  PolylineGeometryDTO,
  TextGeometryDTO,
  ImageGeometryDTO,
} from '@/types';
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
export type { ElementJSON } from '@/types';
export type {
  SelectionMode,
  SelectionFilter,
  SelectionShortcuts,
  HandlePosition,
  TransformMode,
} from '@/types';
export { TransformHandler } from '@/selection';
export { Group } from '@/shapes/group';
export type { GroupData, GroupConflictAction } from '@/types';
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
} from '@/types';
export { TimeMachine } from '@/time-machine';
export type { TimeSnapshot } from '@/types';
export { EventBus } from '@/core/EventBus';
export type { BusEvent } from '@/types';
export { svgNodesToElements } from '@/api/dto/index';
export type { SvgNodeDto } from '@/api/dto/index';
export { RulerManager } from '@/canvas/system/ruler';
export type { GuidelineData, GuidelineEvents } from '@/types';
export {
  BooleanEngine,
  BooleanHandler,
  booleanOperation,
} from '@/math/boolean';
export type { BooleanOp, Pt } from '@/types';
export { DebugLog } from '@/canvas/overlays/debug/DebugLog';
