import type { Point } from '@/types';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { hitTestRect } from '@/selection/hit-test';

export class RectHandler {
  private readonly state: SelectionState;
  private readonly elements: () => SvgElement[];
  private readonly grid: SpatialGrid;
  private readonly lookupGroup: (elementId: string) => string | undefined;
  public onGroupSelect: ((groupId: string | null) => void) | null = null;
  private startPoint = { x: 0, y: 0 };
  private active = false;

  public constructor(
    state: SelectionState,
    elements: () => SvgElement[],
    grid: SpatialGrid,
    lookupGroup: (elementId: string) => string | undefined,
  ) {
    this.state = state;
    this.elements = elements;
    this.grid = grid;
    this.lookupGroup = lookupGroup;
  }

  public get isActive(): boolean {
    return this.active;
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
    this.startPoint = { ...worldPoint };
    this.active = true;
  }

  public move(
    worldPoint: Point,
  ): { x: number; y: number; w: number; h: number } | null {
    if (!this.active) return null;
    this._boxDirection = worldPoint.x >= this.startPoint.x ? 'left-to-right' : 'right-to-left';
    return this.normalizeRect(worldPoint);
  }

  public end(worldPoint: Point, ctrl: boolean): void {
    if (!this.active) return;
    this.active = false;

    const rect = this.normalizeRect(worldPoint);
    this._hadDrag = rect.w >= 3 || rect.h >= 3;
    if (!this._hadDrag) return;

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
        hits.map((e) => this.lookupGroup(e.id)).filter((gid): gid is string => gid !== undefined),
      );

      if (ctrl) {
        for (const gid of groupIds) {
          const groupElements = this.elements().filter((e) => this.lookupGroup(e.id) === gid);
          const allSelected = groupElements.every((g) =>
            this.state.selected.some((s) => s.id === g.id),
          );
          if (allSelected) {
            this.state.remove(groupElements);
          } else {
            this.state.add(groupElements);
          }
        }
      } else {
        this.state.clear();
        if (groupIds.size === 1) {
          const gid = groupIds.values().next().value;
          if (gid !== undefined) this.onGroupSelect?.(gid);
        }
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
