import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionState } from '@/selection/SelectionState';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import { hitTestPoint } from '@/selection/hit-test';

export class ClickHandler {
  private readonly state: SelectionState;
  private readonly elements: () => SvgElement[];
  private readonly grid: SpatialGrid;
  private readonly cameraGroup: SVGGElement;

  public constructor(
    state: SelectionState,
    elements: () => SvgElement[],
    grid: SpatialGrid,
    cameraGroup: SVGGElement,
  ) {
    this.state = state;
    this.elements = elements;
    this.grid = grid;
    this.cameraGroup = cameraGroup;
  }

  public handle(px: number, py: number, ctrl: boolean): void {
    const all = this.elements();
    const hits = hitTestPoint(px, py, all, this.grid, this.cameraGroup);

    if (hits.length === 0) {
      if (!ctrl) this.state.clear();
      return;
    }

    const picked = hits[hits.length - 1];

    if (this.state.mode === 'group' && picked.groupId) {
      const groupElements = all.filter((e) => e.groupId === picked.groupId);
      if (ctrl) {
        const someSelected = groupElements.some((g) =>
          this.state.selected.some((s) => s.id === g.id),
        );
        if (someSelected) {
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
      this.state.toggle([picked]);
    } else {
      this.state.replace([picked]);
    }
  }
}
