import { ReactiveNode } from '@/core/ReactiveNode';
import type { Camera } from '@/canvas/Camera';

const GUIDELINE_COLOR = '#ff4444';
const GUIDELINE_WIDTH = 1;

export class Guideline extends ReactiveNode {
  public x1 = 0;
  public y1 = 0;
  public x2 = 0;
  public y2 = 0;
  public visibility = 'visible';

  public readonly orientation: 'v' | 'h';
  public position: number;

  private _screenPos = 0;

  constructor(
    id: string,
    orientation: 'v' | 'h',
    position: number,
    registerDirty: (instance: any) => void,
  ) {
    super(id, 'line', 'overlayRoot');
    this.pushDiffRendering = registerDirty;
    this.orientation = orientation;
    this.position = position;
  }

  public sync(camera: Camera, viewW: number, viewH: number): void {
    const screen = camera.worldToScreen({
      x: this.orientation === 'v' ? this.position : 0,
      y: this.orientation === 'h' ? this.position : 0,
    });
    if (this.orientation === 'v') {
      this._screenPos = screen.x;
      this.x1 = screen.x;
      this.x2 = screen.x;
      this.y1 = 0;
      this.y2 = viewH;
    } else {
      this._screenPos = screen.y;
      this.y1 = screen.y;
      this.y2 = screen.y;
      this.x1 = 0;
      this.x2 = viewW;
    }
  }

  public setPosition(position: number): void {
    this.position = position;
  }

  public setVisible(visible: boolean): void {
    this.visibility = visible ? 'visible' : 'hidden';
  }

  public get isVisible(): boolean {
    return this.visibility === 'visible';
  }

  public hitTest(sx: number, sy: number, tolerance: number): boolean {
    if (!this.isVisible) return false;
    const coord = this.orientation === 'v' ? sx : sy;
    return Math.abs(coord - this._screenPos) <= tolerance;
  }

  public override getRenderingPayload(): Record<string, unknown> {
    return {
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      stroke: GUIDELINE_COLOR,
      'stroke-width': GUIDELINE_WIDTH,
      'stroke-dasharray': '4 3',
      'pointer-events': 'stroke',
      visibility: this.visibility,
    };
  }
}
