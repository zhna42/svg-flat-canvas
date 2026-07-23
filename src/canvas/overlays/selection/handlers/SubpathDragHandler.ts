import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import type { Point } from '@/core/type';

export class SubpathDragHandler {
  private _active = false;
  private _element: PathElement | null = null;
  private _subpathIdx = -1;
  private _lastWorld: Point = { x: 0, y: 0 };

  public get isActive(): boolean {
    return this._active;
  }

  public get subpathIdx(): number {
    return this._subpathIdx;
  }

  public tryStart(
    elementId: string,
    subpathIdx: number,
    elements: AbstractGraphicElement[],
    worldPoint: Point,
  ): boolean {
    const el = elements.find((e) => e.id === elementId);
    if (!el || !(el instanceof PathElement)) return false;
    const ranges = el.getSubpathRanges();
    if (subpathIdx < 0 || subpathIdx >= ranges.length) return false;
    this._active = true;
    this._element = el;
    this._subpathIdx = subpathIdx;
    this._lastWorld = { x: worldPoint.x, y: worldPoint.y };
    return true;
  }

  public move(worldPoint: Point): void {
    if (!this._active || !this._element) return;
    const frameDx = worldPoint.x - this._lastWorld.x;
    const frameDy = worldPoint.y - this._lastWorld.y;
    this._lastWorld = { x: worldPoint.x, y: worldPoint.y };
    this._element.translateSubpath(this._subpathIdx, frameDx, frameDy);
  }

  public end(): void {
    if (!this._active || !this._element) return;
    this._element.rebuildHitArea();

    this._active = false;
    this._element = null;
    this._subpathIdx = -1;
  }

  public abort(): void {
    if (!this._active) return;
    this._active = false;
    this._element = null;
    this._subpathIdx = -1;
  }
}
