import type { Point } from '@/types';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { hitTestLasso } from '@/selection/hit-test';

export class LassoHandler {
  private readonly state: SelectionState;
  private readonly elements: () => SvgElement[];
  private readonly grid: SpatialGrid;
  private readonly lookupGroup: (elementId: string) => string | undefined;
  private points: Point[] = [];
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

    if (this.state.mode === 'group') {
      const groupIds = new Set(
        hits.map((e) => this.lookupGroup(e.id)).filter((gid): gid is string => gid !== undefined),
      );
      const groupElements = this.elements().filter((e) => {
        const gid = this.lookupGroup(e.id);
        return gid !== undefined && groupIds.has(gid);
      });

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
      this.points = [];
      return;
    }

    if (ctrl) {
      for (const h of hits) {
        this.state.toggle([h]);
      }
    } else {
      this.state.replace(hits);
    }

    this.points = [];
  }
}
