import type { Point } from '@/types';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { hitTestRect } from '@/selection/hit-test';

export class RectHandler {
  private readonly state: SelectionState;
  private readonly elements: () => SvgElement[];
  private readonly grid: SpatialGrid;
  private _startPoint = { x: 0, y: 0 };
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

  public get startPoint(): { x: number; y: number } {
    return this._startPoint;
  }

  public hasDrag(): boolean {
    return this._hadDrag;
  }

  public get boxDirection(): 'left-to-right' | 'right-to-left' {
    return this._boxDirection;
  }

  private _hadDrag = false;
  private _boxDirection: 'left-to-right' | 'right-to-left' = 'left-to-right';

  public start(worldPoint: Point): void {
    this._startPoint = { ...worldPoint };
    this.active = true;
  }

  public move(
    worldPoint: Point,
  ): { x: number; y: number; w: number; h: number } | null {
    if (!this.active) return null;
    this._boxDirection = worldPoint.x >= this._startPoint.x ? 'left-to-right' : 'right-to-left';
    return this.normalizeRect(worldPoint);
  }

  public end(worldPoint: Point, ctrl: boolean): void {
    if (!this.active) return;
    this.active = false;

    const rect = this.normalizeRect(worldPoint);
    this._hadDrag = rect.w >= 3 || rect.h >= 3;
    if (!this._hadDrag) return;

    const leftToRight = worldPoint.x >= this._startPoint.x;
    const hits = hitTestRect(
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      this.elements(),
      this.grid,
      leftToRight,
    );

    if (ctrl) {
      for (const h of hits) {
        this.state.toggle([h]);
      }
    } else {
      this.state.replace(hits);
    }
  }

  public reset(): void {
    this.active = false;
    const rect = this.normalizeRect({ x: this._startPoint.x, y: this._startPoint.y } as Point);
    this._hadDrag = rect.w >= 3 || rect.h >= 3;
  }

  private normalizeRect(p: Point): {
    x: number;
    y: number;
    w: number;
    h: number;
  } {
    return {
      x: Math.min(this.startPoint.x, p.x),
      y: Math.min(this.startPoint.y, p.y),
      w: Math.abs(p.x - this.startPoint.x),
      h: Math.abs(p.y - this.startPoint.y),
    };
  }
}
