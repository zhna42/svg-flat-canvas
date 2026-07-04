import { ReactiveNode } from '@/core/ReactiveNode';
import type { IRenderableNode, LayerName } from '@/types';

export class RectOverlay extends ReactiveNode {
  public x = 0;
  public y = 0;
  public width = 0;
  public height = 0;
  public fill = 'rgba(66, 133, 244, 0.12)';
  public stroke = '#4285f4';
  public strokeWidth = 1;
  public visibility: 'visible' | 'hidden' = 'hidden';

  constructor(registerDirty: (node: IRenderableNode) => void) {
    super('rect-overlay', 'rect', 'selectionOverlay' as LayerName);
    this.pushDiffRendering = registerDirty;
  }

  public override getRenderingPayload(): Record<string, unknown> {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      fill: this.fill,
      stroke: this.stroke,
      'stroke-width': this.strokeWidth,
      visibility: this.visibility,
      'pointer-events': 'none',
    };
  }

  public show(svgX: number, svgY: number): void {
    this.x = svgX;
    this.y = svgY;
    this.width = 0;
    this.height = 0;
    this.visibility = 'visible';
  }

  public update(svgX: number, svgY: number, leftToRight: boolean): void {
    this.x = Math.min(svgX, svgX - (svgX > this.x ? 0 : this.x - svgX));
    this.width = Math.abs(svgX - this.x);
    this.y = Math.min(svgY, svgY - (svgY > this.y ? 0 : this.y - svgY));
    this.height = Math.abs(svgY - this.y);
    this.fill = leftToRight
      ? 'rgba(200, 120, 0, 0.12)'
      : 'rgba(66, 133, 244, 0.12)';
    this.stroke = leftToRight ? '#c87800' : '#4285f4';
  }

  public hide(): void {
    this.visibility = 'hidden';
    this.width = 0;
    this.height = 0;
  }
}
