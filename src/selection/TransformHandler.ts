import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { HandlePosition } from './SelectionOverlay';
import type { Camera } from '@/camera/Camera';
import type { CommandBus } from '@/commands/CommandBus';

export type TransformMode = 'resize' | 'rotate';

export class TransformHandler {
  private _active = false;
  private _mode: TransformMode = 'resize';
  private handle: HandlePosition = 'se';
  private originBBoxes = new Map<string, { x: number; y: number; w: number; h: number }>();
  private startMatrices = new Map<string, DOMMatrix>();
  private targets: SvgElement[] = [];
  private startPoint = { x: 0, y: 0 };

  public onTransformStart: ((mode: TransformMode) => void) | null = null;
  public onTransformMove: (() => void) | null = null;
  public onTransformEnd: ((mode: TransformMode) => void) | null = null;

  public constructor(_camera: Camera, _bus: CommandBus) {}

  public get isActive(): boolean { return this._active; }
  public get mode(): TransformMode { return this._mode; }

  public tryStart(
    handle: HandlePosition, _bbox: DOMRect, _element: SvgElement,
    worldPoint: { x: number; y: number },
    currentSelected: readonly SvgElement[],
  ): boolean {
    this._mode = 'resize';
    this.originBBoxes.clear();
    this.startMatrices.clear();
    for (const el of currentSelected) {
      const b = el.getTransformedBBox();
      this.originBBoxes.set(el.id, { x: b.x, y: b.y, w: b.width, h: b.height });
      this.startMatrices.set(el.id, new DOMMatrix(el.matrix.toString()));
    }
    this._active = true;
    this.handle = handle;
    this.targets = Array.from(currentSelected);
    this.startPoint = { ...worldPoint };
    this.onTransformStart?.(this._mode);
    return true;
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;
    const dx = worldPoint.x - this.startPoint.x;
    const dy = worldPoint.y - this.startPoint.y;
    if (this._mode === 'resize') {
      this.applyResizePreview(dx, dy);
    } else {
      this.applyRotatePreview(worldPoint);
    }
    this.onTransformMove?.();
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;
    for (const el of this.targets) {
      el.buildHitArea();
      el.setDirty();
    }
    this.originBBoxes.clear();
    this.startMatrices.clear();
    this.onTransformEnd?.(this._mode);
  }

  public abort(): void {
    this._active = false;
    this.originBBoxes.clear();
    this.startMatrices.clear();
  }

  private applyResizePreview(dx: number, dy: number): void {
    for (const el of this.targets) {
      const o = this.originBBoxes.get(el.id);
      const startMatrix = this.startMatrices.get(el.id);
      if (!o || !startMatrix) continue;

      let w = o.w, h = o.h;
      const flipW = this.handle === 'w' || this.handle === 'nw' || this.handle === 'sw';
      const flipH = this.handle === 'n' || this.handle === 'nw' || this.handle === 'ne';

      if (flipW) { w = o.w - dx; }
      else if (this.handle === 'e' || this.handle === 'ne' || this.handle === 'se') { w = o.w + dx; }

      if (flipH) { h = o.h - dy; }
      else if (this.handle === 's' || this.handle === 'se' || this.handle === 'sw') { h = o.h + dy; }

      w = Math.max(10, w);
      h = Math.max(10, h);

      const sx = w / o.w;
      const sy = h / o.h;

      let pinX = o.x, pinY = o.y;
      if (flipW) pinX = o.x + o.w;
      if (flipH) pinY = o.y + o.h;

      const change = new DOMMatrix()
        .translateSelf(pinX, pinY)
        .scaleSelf(sx, sy)
        .translateSelf(-pinX, -pinY);

      el.matrix = change.multiply(startMatrix);
      el.decomposeMatrix();
      el.invalidateHitArea();
    }
  }

  private applyRotatePreview(worldPoint: { x: number; y: number }): void {
    for (const el of this.targets) {
      const o = this.originBBoxes.get(el.id);
      const startMatrix = this.startMatrices.get(el.id);
      if (!o || !startMatrix) continue;

      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const curAngle = Math.atan2(worldPoint.y - cy, worldPoint.x - cx) * (180 / Math.PI) + 90;

      const change = new DOMMatrix()
        .translateSelf(cx, cy)
        .rotateSelf(0, 0, curAngle)
        .translateSelf(-cx, -cy);

      el.matrix = change.multiply(startMatrix);
      el.decomposeMatrix();
      el.invalidateHitArea();
    }
  }
}
