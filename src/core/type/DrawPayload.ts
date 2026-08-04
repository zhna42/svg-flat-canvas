export type LayerName =
  | 'shapesGroup'
  | 'previewGroup'
  | 'groupSelectionOverlay'
  | 'selectionOverlay'
  | 'nodeEditOverlay'
  | 'overlayRoot';

export interface DrawPayload {
  id: string;
  type: string;
  layerName?: LayerName;
  [key: string]: unknown;
}
