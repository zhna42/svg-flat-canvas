import type { SvgElement } from '@/shapes/elements/SvgElement';

export class DragHandler {
  private readonly getElements: () => readonly SvgElement[];
  private readonly getGroupElementIds: () => string[];
  private _active = false;
  private prevWorld = { x: 0, y: 0 };
  private targets: SvgElement[] = [];

  public onDragStart: (() => void) | null = null;
  public onDragMove: (() => void) | null = null;
  public onDragEnd: (() => void) | null = null;

  public constructor(
    getElements: () => readonly SvgElement[],
    getGroupElementIds: () => string[],
  ) {
    this.getElements = getElements;
    this.getGroupElementIds = getGroupElementIds;
  }

  public get isActive(): boolean {
    return this._active;
  }

  public tryStart(worldPoint: { x: number; y: number }, currentSelected: readonly SvgElement[]): boolean {
    if (currentSelected.length === 0) return false;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of currentSelected) {
      const bbox = el.getTransformedBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;
      if (bbox.x < minX) minX = bbox.x;
      if (bbox.y < minY) minY = bbox.y;
      if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
      if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
    }
    if (!isFinite(minX)) return false;

    const pad = Math.max((maxX - minX) * 0.25, (maxY - minY) * 0.25, 10);
    if (
      worldPoint.x < minX - pad || worldPoint.x > maxX + pad ||
      worldPoint.y < minY - pad || worldPoint.y > maxY + pad
    ) {
      return false;
    }

    this._active = true;
    this.prevWorld = { ...worldPoint };

    const groupIds = this.getGroupElementIds();
    if (groupIds.length > 0) {
      const all = this.getElements();
      const groupSet = new Set(groupIds);
      this.targets = all.filter((e) => groupSet.has(e.id));
    } else {
      this.targets = Array.from(currentSelected);
    }

    this.onDragStart?.();
    return true;
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;
    const dx = worldPoint.x - this.prevWorld.x;
    const dy = worldPoint.y - this.prevWorld.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    for (const el of this.targets) {
      el.applyDelta(dx, dy);
    }
    this.prevWorld = { ...worldPoint };
    this.onDragMove?.();
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;

    for (const el of this.targets) {
      el.flushTransformToCoords();
    }
    this.targets = [];
    this.onDragEnd?.();
  }
}

