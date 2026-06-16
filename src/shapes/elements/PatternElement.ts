import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';

export class PatternElement extends AbstractGraphicElement {
  public geometry = {
    x: 0,
    y: 0,
    width: 16,
    height: 16,
    patternUnits: 'userSpaceOnUse',
  };
  public cells: {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
  }[] = [];

  public constructor(id: string) {
    super(id, 'pattern');
  }

  public get hitArea(): Point[] {
    return [];
  }

  public buildHitArea(): void {}

  public getBBox(): BoundingBox {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return {
      id: this.id,
      x: this.geometry.x,
      y: this.geometry.y,
      width: this.geometry.width,
      height: this.geometry.height,
      patternUnits: this.geometry.patternUnits,
      cells: this.cells,
    };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return this.getGeometryProps();
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) this.geometry.x = data.x as number;
    if (data.y !== undefined) this.geometry.y = data.y as number;
    if (data.width !== undefined) this.geometry.width = data.width as number;
    if (data.height !== undefined) this.geometry.height = data.height as number;
    if (data.patternUnits !== undefined)
      this.geometry.patternUnits = data.patternUnits as string;
    if (data.cells !== undefined) this.cells = data.cells as typeof this.cells;
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as PatternElement;
    el.geometry = { ...this.geometry };
    el.cells = this.cells.map((c) => ({ ...c }));
  }
}
