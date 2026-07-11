import { ReactiveNode } from '@/core/ReactiveNode';
import { MM_TO_PX } from '@/constants';

export class Artboard extends ReactiveNode {
  public widthMM = 210;
  public heightMM = 297;
  public fill = '#ffffff';

  constructor(registerDirty: (instance: any) => void) {
    super('artboard', 'rect', 'overlayRoot');
    this.pushDiffRendering = registerDirty;
    registerDirty(this);
  }

  public setSize(widthMM: number, heightMM: number): void {
    this.widthMM = widthMM;
    this.heightMM = heightMM;
  }

  public get widthPx(): number {
    return this.widthMM * MM_TO_PX;
  }

  public get heightPx(): number {
    return this.heightMM * MM_TO_PX;
  }
}
