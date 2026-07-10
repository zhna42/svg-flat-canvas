import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type GroupHandlePosition =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

export interface OverlaySnapshot {
  transform: string | null;
  rectAttrs: Record<string, string | number>;
  handlePositions: { cx: number; cy: number }[];
  visible: boolean;
}

export type SelectionFilter = (
  elements: AbstractGraphicElement[],
) => AbstractGraphicElement[];

export interface SelectionShortcuts {
  selectElement: string;
  selectGroup: string;
}

export type TransformMode = 'resize' | 'rotate';

export type GroupTransformMode = 'resize' | 'rotate';

export type SnapAxisMode = 'both' | 'horizontal' | 'vertical';

export interface WorldSnapResult {
  correctionDx: number;
  correctionDy: number;
  screenDx: number;
  screenDy: number;
  type: 'point' | 'line' | 'curve';
  lineStartX?: number;
  lineStartY?: number;
  lineEndX?: number;
  lineEndY?: number;
}

export interface SelectionHandlerOptions {
  svg: SVGSVGElement;
  camera: import('@/canvas/Camera').Camera;
  selectionManager: import('@/canvas/overlays/selection/SelectionManager').SelectionManager;
  pathNodeOverlay: any;
  nodeEdit: import('@/canvas/overlays/nodeedit/NodeEditCoordinator').NodeEditCoordinator;
  transformHandler: import('@/canvas/overlays/selection/transform/TransformHandler').TransformHandler;
  groupTransformHandler: import('@/canvas/overlays/selection/transform/GroupTransformHandler').GroupTransformHandler;
  state: import('@/canvas/overlays/selection/SelectionState').SelectionState;
  getElements: () => AbstractGraphicElement[];
  hitTestEngine: import('@/core/HitTestEngine').HitTestEngine;
  bus: import('@/core/CommandBus').CommandBus;
  registerDirty: (node: import('@/types').IRenderableNode) => void;
  timeMachine?: import('@/time-machine/TimeMachine').TimeMachine;
  isPanning?: () => boolean;
  isCreating?: () => boolean;
  isGuidelineDragging?: () => boolean;
  shortcuts?: Partial<SelectionShortcuts>;
  getGroupIdForElement?: (elementId: string) => string | undefined;
  getSelectedGroups?: () => import('@/shapes/group/Group').Group[];
  getArtboardRect?: () => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  onGroupSelect?: (ids: string[]) => void;
  onDragStart?: () => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
  onSetEditingPath?: (path: AbstractGraphicElement | null) => void;
  getEditingPath?: () => AbstractGraphicElement | null;
  canInteract?: (elementId: string) => boolean;
  canMove?: (elementId: string) => boolean;
  isTextEditing?: () => boolean;
  onTextEdit?: (el: AbstractGraphicElement) => void;
  getGuidelines?: () => Array<{
    orientation: 'v' | 'h';
    position: number;
  }>;
  getGridLines?: () => Array<{
    orientation: 'v' | 'h';
    position: number;
  }>;
  events: import('@/core/EventBus').EventBus;
}

export interface GroupSelectionHandlerOptions {
  getElements: () => AbstractGraphicElement[];
  hitTestEngine: import('@/core/HitTestEngine').HitTestEngine;
  lookupGroup: (elementId: string) => string | undefined;
  camera: import('@/canvas/Camera').Camera;
  bus: import('@/core/CommandBus').CommandBus;
  dragHandler: import('@/canvas/overlays/selection/drag').DragHandler;
  onGroupSelect?: (ids: string[]) => void;
}

export interface PathNodeActivation {
  element: import('@/shapes/elements/PathElement').PathElement;
  cmdIdx: number;
  ptIdx: number;
  startMouseWorld: import('@/types').Point;
  startCommands: import('@/types').PathCommand[];
  lastMouseWorld: import('@/types').Point;
}
