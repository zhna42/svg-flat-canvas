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
    this._mode = handle === 'rotate' ? 'rotate' : 'resize';
    this.originBBoxes.clear();
    for (const el of currentSelected) {
      const b = el.getTransformedBBox();
      this.originBBoxes.set(el.id, { x: b.x, y: b.y, w: b.width, h: b.height });
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
      el.flushTransformToCoords();
    }
    this.originBBoxes.clear();
    this.onTransformEnd?.(this._mode);
  }

  public abort(): void {
    this._active = false;
    this.originBBoxes.clear();
  }

  private applyResizePreview(dx: number, dy: number): void {
    for (const el of this.targets) {
      const orig = this.originBBoxes.get(el.id);
      if (!orig) continue;

      let w = orig.w, h = orig.h;
      const flipW = this.handle === 'w' || this.handle === 'nw' || this.handle === 'sw';
      const flipH = this.handle === 'n' || this.handle === 'nw' || this.handle === 'ne';

      if (flipW) { w = orig.w - dx; }
      else if (this.handle === 'e' || this.handle === 'ne' || this.handle === 'se') { w = orig.w + dx; }

      if (flipH) { h = orig.h - dy; }
      else if (this.handle === 's' || this.handle === 'se' || this.handle === 'sw') { h = orig.h + dy; }

      w = Math.max(10, w);
      h = Math.max(10, h);

      const sx = w / orig.w;
      const sy = h / orig.h;

      let pinX = orig.x, pinY = orig.y;
      if (flipW) pinX = orig.x + orig.w;
      if (flipH) pinY = orig.y + orig.h;

      el.element.setAttribute(
        'transform',
        `translate(${pinX}, ${pinY}) scale(${sx}, ${sy}) translate(${-pinX}, ${-pinY})`,
      );
      el.invalidateHitArea();
      el.buildHitArea();
      el.setDirty();
    }
  }

  private applyRotatePreview(worldPoint: { x: number; y: number }): void {
    for (const el of this.targets) {
      const orig = this.originBBoxes.get(el.id);
      if (!orig) continue;
      const cx = orig.x + orig.w / 2;
      const cy = orig.y + orig.h / 2;
      const angle = Math.atan2(worldPoint.y - cy, worldPoint.x - cx) * (180 / Math.PI) + 90;
      const last = (el as any)._lastAngle ?? angle;
      el.element.setAttribute('transform', '');
      el.rotate(angle - last, cx, cy);
      (el as any)._lastAngle = angle;
      el.invalidateHitArea();
      el.buildHitArea();
      el.setDirty();
    }
  }
}
