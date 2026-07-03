import { ReactiveNode } from '@/core/ReactiveNode';

export class Rulers extends ReactiveNode {
  public visible = true;
  public guidelinesVisibleV = true;
  public guidelinesVisibleH = true;

  #guidelines: Map<string, { orientation: 'v' | 'h'; position: number }> =
    new Map();

  constructor(registerDirty: (instance: any) => void) {
    super('rulers', 'g', 'overlayRoot');
    this.pushDiffRendering = registerDirty;
  }

  public toggle(): void {
    this.visible = !this.visible;
  }

  public addGuideline(orientation: 'v' | 'h', position: number): string {
    const id = `guideline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.#guidelines.set(id, { orientation, position });
    return id;
  }

  public removeGuideline(id: string): void {
    this.#guidelines.delete(id);
  }

  public getGuidelines(): Array<{
    id: string;
    orientation: 'v' | 'h';
    position: number;
  }> {
    return Array.from(this.#guidelines.entries()).map(([id, g]) => ({
      id,
      orientation: g.orientation,
      position: g.position,
    }));
  }

  public setGuidelinesVisible(orientation: 'v' | 'h', visible: boolean): void {
    if (orientation === 'v') this.guidelinesVisibleV = visible;
    else this.guidelinesVisibleH = visible;
  }

  public getGuidelinesVisible(orientation: 'v' | 'h'): boolean {
    return orientation === 'v'
      ? this.guidelinesVisibleV
      : this.guidelinesVisibleH;
  }
}
