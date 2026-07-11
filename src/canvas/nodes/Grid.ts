import { ReactiveNode } from '@/core/ReactiveNode';

export class Grid extends ReactiveNode {
  public visible = false;
  public stepMM = 10;

  constructor(registerDirty: (instance: any) => void) {
    super('grid', 'g', 'overlayRoot');
    this.pushDiffRendering = registerDirty;
  }

  public setStep(mm: number): void {
    this.stepMM = mm;
  }

  public toggle(): void {
    this.visible = !this.visible;
  }
}
