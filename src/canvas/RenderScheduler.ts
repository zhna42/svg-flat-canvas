import { CanvasView } from './CanvasView';
import { DrawPayload } from '@/types';
import type { IRenderableNode } from '@/types';

export class RenderScheduler {
  _view: CanvasView | null = null;
  _dirtyNodes = new Set<IRenderableNode>();
  _rafId: number | null = null;

  public setView(view: CanvasView): void {
    this._view = view;
  }

  public registerDirtyNode = (node: IRenderableNode): void => {
    this._dirtyNodes.add(node);
    this._requestFrame();
  };

  _requestFrame(): void {
    if (this._rafId === null && this._dirtyNodes.size > 0) {
      this._rafId = requestAnimationFrame(this._tick);
    }
  }

  _tick = (): void => {
    this._rafId = null;

    if (this._dirtyNodes.size === 0) return;
    if (!this._view) return;

    for (const node of this._dirtyNodes) {
      const payload: DrawPayload = {
        id: node.id,
        type: node.type,
        layerName: node.layerName,
        ...node.getRenderingPayload(),
      };
      this._view.draw(payload);
      node.clearRenderingDiff();
    }

    this._dirtyNodes.clear();
  };
}
