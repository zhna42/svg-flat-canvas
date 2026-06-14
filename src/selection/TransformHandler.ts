import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { HandlePosition } from './SelectionOverlay';
import type { Camera } from '@/camera/Camera';
import type { CommandBus } from '@/commands/CommandBus';

export type TransformMode = 'resize' | 'rotate';

export class TransformHandler {
  private _active = false;
  private _mode: TransformMode = 'resize';
  private handle: HandlePosition = 'se';
  private origins = new Map<string, { x: number; y: number; w: number; h: number; tx: number; ty: number; sx: number; sy: number }>();
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
    this.origins.clear();
    for (const el of currentSelected) {
      const bbox = el.getTransformedBBox();
      const uw = bbox.width / el._scaleX;
      const uh = bbox.height / el._scaleY;
      const ux = bbox.x - el._translate.x;
      const uy = bbox.y - el._translate.y;
      this.origins.set(el.id, { x: ux, y: uy, w: uw, h: uh, tx: el._translate.x, ty: el._translate.y, sx: el._scaleX, sy: el._scaleY });
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
    this.origins.clear();
    this.onTransformEnd?.(this._mode);
  }

  public abort(): void {
    this._active = false;
    this.origins.clear();
  }

  private applyResizePreview(dx: number, dy: number): void {
    for (const el of this.targets) {
      const o = this.origins.get(el.id);
      if (!o) continue;
      el.applyTransformOp({ type: 'resize', handle: this.handle, dx, dy, ox: o.x, oy: o.y, ow: o.w, oh: o.h, otx: o.tx, oty: o.ty, osx: o.sx, osy: o.sy });
    }
  }

  private applyRotatePreview(worldPoint: { x: number; y: number }): void {
    for (const el of this.targets) {
      const o = this.origins.get(el.id);
      if (!o) continue;
      const cx = o.x + o.w / 2 + o.tx;
      const cy = o.y + o.h / 2 + o.ty;
      const angle = Math.atan2(worldPoint.y - cy, worldPoint.x - cx) * (180 / Math.PI) + 90;
      el.applyTransformOp({ type: 'rotate', angle, cx, cy });
    }
  }
}
