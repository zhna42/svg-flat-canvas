import type { LayerName } from './DrawPayload';

export interface IRenderableNode {
  id: string;
  type: string;
  layerName: LayerName;
  renderingDiff: Record<string, unknown>;
  clearRenderingDiff(): void;
  getRenderingPayload(): Record<string, unknown>;
}
