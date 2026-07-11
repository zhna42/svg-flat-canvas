import { ReactiveNode } from '@/core/ReactiveNode';

export class Selection extends ReactiveNode {
  public visible = true;

  constructor(registerDirty: (instance: any) => void) {
    super('selection', 'g', 'overlayRoot');
    this.pushDiffRendering = registerDirty;
  }
}
