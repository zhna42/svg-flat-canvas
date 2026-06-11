import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { hitTestPoint } from '@/selection/hit-test';

export class ClickHandler {
  private readonly state: SelectionState;
  private readonly elements: () => SvgElement[];
  private readonly grid: SpatialGrid;
  private readonly cameraGroup: SVGGElement;
  private readonly lookupGroup: (elementId: string) => string | undefined;
  public onGroupSelect: ((groupId: string | null) => void) | null = null;

  public constructor(
    state: SelectionState,
    elements: () => SvgElement[],
    grid: SpatialGrid,
    cameraGroup: SVGGElement,
    lookupGroup: (elementId: string) => string | undefined,
  ) {
    this.state = state;
    this.elements = elements;
    this.grid = grid;
    this.cameraGroup = cameraGroup;
    this.lookupGroup = lookupGroup;
  }

  public handle(px: number, py: number, ctrl: boolean): void {
    const all = this.elements();
    const hits = hitTestPoint(px, py, all, this.grid, this.cameraGroup);

    if (hits.length === 0) {
      if (!ctrl) {
        this.state.clear();
        if (this.onGroupSelect) this.onGroupSelect(null);
      }
      return;
    }

    const picked = hits[hits.length - 1];

    if (this.state.mode === 'group') {
      const groupId = this.lookupGroup(picked.id);
      if (groupId) {
        if (ctrl) {
          const groupElements = all.filter((e) => this.lookupGroup(e.id) === groupId);
          const someSelected = groupElements.some((g) =>
            this.state.selected.some((s) => s.id === g.id),
          );
          if (someSelected) {
            this.state.remove(groupElements);
          } else {
            this.state.add(groupElements);
          }
        } else {
          this.state.clear();
          this.onGroupSelect?.(groupId);
        }
      }
    }

    if (ctrl) {
      this.state.toggle([picked]);
    } else {
      this.state.replace([picked]);
    }
  }
}
