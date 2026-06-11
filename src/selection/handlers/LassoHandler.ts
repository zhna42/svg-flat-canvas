import type { Point } from '@/types';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { hitTestLasso } from '@/selection/hit-test';

export class LassoHandler {
  private readonly state: SelectionState;
  private readonly elements: () => SvgElement[];
  private readonly grid: SpatialGrid;
  private points: Point[] = [];
  private active = false;

  public constructor(
    state: SelectionState,
    elements: () => SvgElement[],
    grid: SpatialGrid,
  ) {
    this.state = state;
    this.elements = elements;
    this.grid = grid;
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get currentPoints(): readonly Point[] {
    return this.points;
  }

  public start(px: number, py: number): void {
    this.points = [{ x: px, y: py }];
    this.active = true;
  }

  public move(px: number, py: number): void {
    if (!this.active) return;
    this.points.push({ x: px, y: py });
  }

  public end(_px: number, _py: number, ctrl: boolean): void {
    if (!this.active) return;
    this.active = false;

    if (this.points.length < 3) {
      this.points = [];
      return;
    }

    const hits = hitTestLasso(this.points, this.elements(), this.grid);

    if (ctrl) {
      for (const h of hits) {
        this.state.toggle([h]);
      }
    } else {
      this.state.replace(hits);
    }

    this.points = [];
  }

  public reset(): void {
    this.active = false;
    this.points = [];
  }
}
