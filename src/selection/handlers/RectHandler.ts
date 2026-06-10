import type { Point } from '@/types';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { hitTestRect } from '@/selection/hit-test';

export class RectHandler {
  private readonly state: SelectionState;
  private readonly elements: () => SvgElement[];
  private readonly grid: SpatialGrid;
  private startPoint = { x: 0, y: 0 };
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

  public start(worldPoint: Point): void {
    this.startPoint = { ...worldPoint };
    this.active = true;
  }

  public move(
    worldPoint: Point,
  ): { x: number; y: number; w: number; h: number } | null {
    if (!this.active) return null;
    return this.normalizeRect(worldPoint);
  }

  public end(worldPoint: Point, ctrl: boolean): void {
    if (!this.active) return;
    this.active = false;

    const rect = this.normalizeRect(worldPoint);
    if (rect.w < 3 && rect.h < 3) return;

    const leftToRight = worldPoint.x >= this.startPoint.x;
    const hits = hitTestRect(
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      this.elements(),
      this.grid,
      leftToRight,
    );

    if (this.state.mode === 'group') {
      const groupIds = new Set(
        hits.filter((e) => e.groupId).map((e) => e.groupId),
      );
      const groupElements = this.elements().filter((e) =>
        groupIds.has(e.groupId),
      );

      if (ctrl) {
        const allSelected = groupElements.every((g) =>
          this.state.selected.some((s) => s.id === g.id),
        );
        if (allSelected) {
          this.state.remove(groupElements);
        } else {
          this.state.add(groupElements);
        }
      } else {
        this.state.replace(groupElements);
      }
      return;
    }

    if (ctrl) {
      for (const h of hits) {
        this.state.toggle([h]);
      }
    } else {
      this.state.replace(hits);
    }
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
