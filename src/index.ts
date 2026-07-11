export { ExternalApi } from '@/modules/api';
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
  UseElementGeometryDTO,
} from '@/modules/api';
export { SvgCanvas } from '@/core';
export type { SvgCanvasOptions } from '@/core/type';
export type { Point, BoundingBox, ElementType, PathCommand } from '@/core/type';
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
  UseElement,
  createFromJSON,
  createFromJSONArray,
} from '@/core/shapes';
export type { ElementJSON } from '@/core/type';
export type {
  SelectionMode,
  SelectionFilter,
  SelectionShortcuts,
  HandlePosition,
  TransformMode,
} from '@/core/type';
export { TransformHandler } from '@/canvas/overlays/selection';
export { Group } from '@/core/shapes/group';
export type { GroupData, GroupConflictAction } from '@/core/type';
export { CommandBus } from '@/core/commands/CommandBus';
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
} from '@/core/type';
export { TimeMachine } from '@/core/time-machine';
export type { TimeSnapshot } from '@/core/type';
export { EventBus } from '@/core/event-bus/EventBus';
export type { BusEvent } from '@/core/type';
export { svgNodesToElements } from '@/dto';
export type { SvgNodeDto } from '@/dto';
export { GuidelineManager, Guideline, RulerBuilder } from '@/modules/ruler';
export type { GuidelineData, GuidelineEvents } from '@/core/type';
export {
  BooleanEngine,
  BooleanHandler,
  booleanOperation,
} from '@/core/math/boolean';
export type { BooleanOp, Pt } from '@/core/type';
export { DebugLog } from '@/canvas/overlays/debug/DebugLog';
