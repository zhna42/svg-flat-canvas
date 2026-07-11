import { ReactiveNode } from '@/core/ReactiveNode';

export class Rulers extends ReactiveNode {
  public visible = true;
  public cameraX = 0;
  public cameraY = 0;
  public zoom = 1;
  public viewNonce = 0;
  public flipY = false;
  public worldHeightPx = 0;

  constructor(registerDirty: (instance: any) => void) {
    super('rulers', 'g', 'overlayRoot');
    this.pushDiffRendering = registerDirty;
  }

  public toggle(): void {
    this.visible = !this.visible;
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
  }

  public syncCamera(x: number, y: number, zoom: number): void {
    this.cameraX = x;
    this.cameraY = y;
    this.zoom = zoom;
  }

  public bumpViewport(): void {
    this.viewNonce = (this.viewNonce + 1) % 1_000_000;
  }

  public setFlipY(flip: boolean, heightPx: number): void {
    this.flipY = flip;
    this.worldHeightPx = heightPx;
  }

  public override getRenderingPayload(): Record<string, unknown> {
    return {
      visible: this.visible,
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      zoom: this.zoom,
      flipY: this.flipY,
      worldHeightPx: this.worldHeightPx,
    };
  }
}
