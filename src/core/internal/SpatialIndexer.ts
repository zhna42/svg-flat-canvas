import type { SpatialGrid } from '@/math/spatial/SpatialGrid';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export class SpatialIndexer {
  constructor(private readonly grid: SpatialGrid) {}

  insert(el: AbstractGraphicElement): void {
    const bbox = el.getTransformedBBox();
    const ids = this.grid.insert(
      el.id,
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
    );
    el.setSpatialCellIds(ids);
  }

  remove(el: AbstractGraphicElement): void {
    this.grid.removeById(el.id, el.getSpatialCellIds());
  }

  update(el: AbstractGraphicElement): void {
    const bbox = el.getTransformedBBox();
    const newIds = this.grid.updateElement(
      el.id,
      el.getSpatialCellIds(),
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
    );
    el.setSpatialCellIds(newIds);
  }

  reindexAll(elements: AbstractGraphicElement[]): void {
    this.grid.clear();
    for (const el of elements) {
      this.insert(el);
    }
  }
}
