import type { Point } from './geometry';
import type { ElementType } from './element-type';

/** Тип узла (острота), ручки — производные от него. */
export type NodeKind = 'corner' | 'smooth' | 'symmetric';

/**
 * Канонический редактируемый узел. Координаты — МИРОВЫЕ.
 * handleIn/handleOut — абсолютные позиции контрольных точек (не смещения).
 */
export interface EditNode {
  id: string;
  anchor: Point;
  type: NodeKind;
  handleIn?: Point;
  handleOut?: Point;
}

/** Контур (подпуть). */
export interface EditContour {
  nodes: EditNode[];
  closed: boolean;
}

/** Полная модель узлов одного элемента (в мировых координатах). */
export interface EditNodeModel {
  elementId: string;
  elementType: ElementType;
  contours: EditContour[];
}

/** Ссылка на конкретный узел конкретного элемента. */
export interface NodeRef {
  elementId: string;
  nodeId: string;
}

/** Какая часть узла попала под курсор при хит-тесте. */
export type NodePart = 'anchor' | 'in' | 'out';

export interface NodeHit {
  elementId: string;
  nodeId: string;
  part: NodePart;
}

/**
 * Интерфейс элемента, поддерживающего редактирование узлов.
 * Реализуется Path/Polyline/Polygon.
 */
export interface INodeEditable {
  /** Собрать каноническую модель (мировые координаты). */
  toEditModel(): EditNodeModel;
  /** Применить модель обратно в собственное хранилище. */
  applyEditModel(model: EditNodeModel): void;
  /** Поддерживает ли элемент кривизну (ручки) без конвертации в path. */
  readonly supportsCurves: boolean;
}
