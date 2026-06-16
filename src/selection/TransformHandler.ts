import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { HandlePosition } from './SelectionOverlay';
import type { Camera } from '@/camera/Camera';
import type { CommandBus } from '@/commands/CommandBus';

export type TransformMode = 'resize' | 'rotate';

const ORIGIN_INDEX: Record<string, number> = {
  se: 0, e:  0, ne: 2, n:  2, nw: 3, w:  3, sw: 1, s:  1,
};

const FLIP: Record<string, { x: number; y: number }> = {
  se: { x: 1,  y: 1  }, e:  { x: 1,  y: 0  },
  ne: { x: 1,  y: -1 }, n:  { x: 0,  y: -1 },
  nw: { x: -1, y: -1 }, w:  { x: -1, y: 0  },
  sw: { x: -1, y: 1  }, s:  { x: 0,  y: 1  },
};

export class TransformHandler {
  private _active = false;
  private _handle: HandlePosition = 'se';
  private targets: SvgElement[] = [];
  private startMouse = { x: 0, y: 0 };
  private startMatrices = new Map<string, DOMMatrix>();
  private localBBoxes = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
  private globalOrigins = new Map<string, { x: number; y: number }>();

  public onTransformStart: ((mode: TransformMode) => void) | null = null;
  public onTransformMove: (() => void) | null = null;
  public onTransformEnd: ((mode: TransformMode) => void) | null = null;

  public constructor(_camera: Camera, _bus: CommandBus) {}

  public get isActive(): boolean {
    return this._active;
  }

  public tryStart(
    handle: HandlePosition,
    _bbox: DOMRect,
    _element: SvgElement,
    worldPoint: { x: number; y: number },
    currentSelected: readonly SvgElement[],
  ): boolean {
    const oppIdx = ORIGIN_INDEX[handle] ?? 0;
    this._handle = handle;
    this.targets = Array.from(currentSelected);
    this.startMouse = { x: worldPoint.x, y: worldPoint.y };
    this.startMatrices.clear();
    this.localBBoxes.clear();
    this.globalOrigins.clear();

    for (const el of currentSelected) {
      const ha = el.hitArea;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of ha) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const localBBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      const startMatrix = new DOMMatrix(el.matrix.toString());
      this.startMatrices.set(el.id, startMatrix);
      this.localBBoxes.set(el.id, {
        x: localBBox.x,
        y: localBBox.y,
        w: localBBox.width,
        h: localBBox.height,
      });

      const corners = [
        startMatrix.transformPoint({ x: localBBox.x, y: localBBox.y }),
        startMatrix.transformPoint({
          x: localBBox.x + localBBox.width,
          y: localBBox.y,
        }),
        startMatrix.transformPoint({
          x: localBBox.x,
          y: localBBox.y + localBBox.height,
        }),
        startMatrix.transformPoint({
          x: localBBox.x + localBBox.width,
          y: localBBox.y + localBBox.height,
        }),
      ];
      this.globalOrigins.set(el.id, { x: corners[oppIdx].x, y: corners[oppIdx].y });
    }

    this._active = true;
    this.onTransformStart?.('resize');
    return true;
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;
    const totalDx = worldPoint.x - this.startMouse.x;
    const totalDy = worldPoint.y - this.startMouse.y;
    this.applyResizePreview(totalDx, totalDy);
    this.onTransformMove?.();
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;
    for (const el of this.targets) {
      el.buildHitArea();
      el.setDirty();
    }
    this.startMatrices.clear();
    this.localBBoxes.clear();
    this.globalOrigins.clear();
    this.onTransformEnd?.('resize');
  }

  public abort(): void {
    this._active = false;
    this.startMatrices.clear();
    this.localBBoxes.clear();
    this.globalOrigins.clear();
  }

  private applyResizePreview(totalDx: number, totalDy: number): void {
    for (const el of this.targets) {
      const startMatrix = this.startMatrices.get(el.id);
      const localBBox = this.localBBoxes.get(el.id);
      const globalOrigin = this.globalOrigins.get(el.id);
      if (!startMatrix || !localBBox || !globalOrigin) continue;

      const angleRad = Math.atan2(startMatrix.b, startMatrix.a);
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const rawLocalDx = totalDx * cos + totalDy * sin;
      const rawLocalDy = -totalDx * sin + totalDy * cos;

      const flip = FLIP[this._handle] ?? { x: 1, y: 1 };
      const localDx = rawLocalDx * flip.x;
      const localDy = rawLocalDy * flip.y;

      el.applyTransformation(
        'scale',
        {
          x: localDx,
          y: localDy,
          originX: globalOrigin.x,
          originY: globalOrigin.y,
          width: localBBox.w,
          height: localBBox.h,
        },
        startMatrix,
      );
    }
  }
}
