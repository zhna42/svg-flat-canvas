import type { ElementType, Point } from '@/core/type';

export interface StyleDTO {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
}

export interface TransformDTO {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  matrix?: [number, number, number, number, number, number];
}

export interface RectGeometryDTO {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}

export interface CircleGeometryDTO {
  cx: number;
  cy: number;
  r: number;
}

export interface EllipseGeometryDTO {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface LineGeometryDTO {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PathGeometryDTO {
  d: string;
}

export interface PolygonGeometryDTO {
  points: string;
}

export interface PolylineGeometryDTO {
  points: string;
}

export interface TextGeometryDTO {
  x: string;
  y: string;
  fontSize?: string;
  fontFamily?: string;
  textAnchor?: string;
  textContent?: string;
  boxWidth?: number;
  boxHeight?: number;
  fontSizePx?: number;
  color?: string;
  fontWeight?: string;
}

export interface ImageGeometryDTO {
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  editedImage?: string;
  originalImage?: string;
  processedSource?: string;
  rasterEditorOptions?: Record<string, unknown>;
}

export interface UseElementGeometryDTO {
  refId: string;
  x?: number;
  y?: number;
}

export type ElementGeometryDTO =
  | RectGeometryDTO
  | CircleGeometryDTO
  | EllipseGeometryDTO
  | LineGeometryDTO
  | PathGeometryDTO
  | PolygonGeometryDTO
  | PolylineGeometryDTO
  | TextGeometryDTO
  | ImageGeometryDTO
  | UseElementGeometryDTO;

export interface CreateShapeDTO {
  id?: string;
  type: ElementType;
  geometry: ElementGeometryDTO;
  style?: StyleDTO;
  transform?: TransformDTO;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  groupId?: string | null;
  data?: Record<string, unknown>;
  laserData?: Record<string, unknown>;
}

export interface UpdateShapesDTO {
  elementIds: string[];
  style?: Partial<StyleDTO>;
  transform?: Partial<TransformDTO>;
  geometry?: Partial<ElementGeometryDTO>;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  groupId?: string;
  data?: Record<string, unknown>;
}

export interface DeleteShapesDTO {
  elementIds: string[];
}

export interface MoveShapesDTO {
  elementIds: string[];
  delta: Point;
}

export interface RotateShapesDTO {
  elementIds: string[];
  angle: number;
}

export interface ResizeShapesDTO {
  elementIds: string[];
  bbox: { x: number; y: number; width: number; height: number };
}

export interface SetTransformShapesDTO {
  elementIds: string[];
  matrix: [number, number, number, number, number, number];
}

export interface GroupCreateDTO {
  name?: string;
}

export interface GroupDeleteDTO {
  groupId: string;
}

export interface GroupAddElementsDTO {
  groupId: string;
  elementIds: string[];
}

export interface GroupRemoveElementsDTO {
  groupId: string;
  elementIds: string[];
}

export interface SelectShapesDTO {
  elementIds: string[];
  toggle?: boolean;
}

export interface ClearSelectionDTO {}

export interface SortShapesDTO {
  elementIds: string[];
  targetId: string;
  position: 'before' | 'after';
}
