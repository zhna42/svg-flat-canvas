import { ReactiveNode } from '@/core/ReactiveNode';
import type { Point, IRenderableNode, LayerName } from '@/types';

export class LassoOverlay extends ReactiveNode {
  public points = '';
  public fill = 'rgba(255, 165, 0, 0.1)';
  public stroke = '#ff8c00';
  public strokeWidth = 1.5;
  public strokeDasharray = '3 2';
  public visibility: 'visible' | 'hidden' = 'hidden';

  constructor(registerDirty: (node: IRenderableNode) => void) {
    super('lasso-overlay', 'polygon', 'selectionOverlay' as LayerName);
    this.pushDiffRendering = registerDirty;
  }

  public override getRenderingPayload(): Record<string, unknown> {
    return {
      points: this.points,
      fill: this.fill,
      stroke: this.stroke,
      'stroke-width': this.strokeWidth,
      'stroke-dasharray': this.strokeDasharray,
      'stroke-linejoin': 'round',
      visibility: this.visibility,
      'pointer-events': 'none',
    };
  }

  public show(): void {
    this.points = '';
    this.visibility = 'visible';
  }

  public addPoint(svgPt: Point): void {
    this.points = this.points
      ? `${this.points} ${svgPt.x},${svgPt.y}`
      : `${svgPt.x},${svgPt.y}`;
  }

  public setPoints(points: Point[]): void {
    this.points = points.map((p) => `${p.x},${p.y}`).join(' ');
  }

  public hide(): void {
    this.visibility = 'hidden';
    this.points = '';
  }
}
