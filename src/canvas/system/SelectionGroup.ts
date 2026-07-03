import { ReactiveNode } from '@/core/ReactiveNode';

export class SelectionGroup extends ReactiveNode {
  public visible = true;

  constructor(registerDirty: (instance: any) => void) {
    super('selection-group', 'g', 'groupSelectionOverlay');
    this.pushDiffRendering = registerDirty;
  }
}
