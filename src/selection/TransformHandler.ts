import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { HandlePosition } from './SelectionOverlay';
import type { Camera } from '@/camera/Camera';
import type { CommandBus } from '@/commands/CommandBus';
import type { Point } from '@/types';

export type TransformMode = 'resize' | 'rotate';

const HANDLE_TO_ANCHOR: Record<HandlePosition, HandlePosition> = {
  se: 'nw',
  e: 'w',
  ne: 'sw',
  n: 's',
  nw: 'se',
  w: 'e',
  sw: 'ne',
  s: 'n',
};

const HANDLE_FLIP: Record<string, { x: number; y: number }> = {
  se: { x: 1, y: 1 },
  e: { x: 1, y: 0 },
  ne: { x: 1, y: -1 },
  n: { x: 0, y: -1 },
  nw: { x: -1, y: -1 },
  w: { x: -1, y: 0 },
  sw: { x: -1, y: 1 },
  s: { x: 0, y: 1 },
};

export class TransformHandler {
  private _active = false;
  private handle: HandlePosition = 'se';
  private targets: AbstractGraphicElement[] = [];
  private startWorldPoint: Point = { x: 0, y: 0 };
  private startMatrices = new Map<string, DOMMatrix>();
  private anchorWorldPoints = new Map<string, Point>();

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
    _element: AbstractGraphicElement,
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): boolean {
    this.handle = handle;
    this.targets = Array.from(currentSelected);
    this.startWorldPoint = { x: worldPoint.x, y: worldPoint.y };
    this.startMatrices.clear();
    this.anchorWorldPoints.clear();

    const anchorCorner = HANDLE_TO_ANCHOR[handle];

    console.log(
      '[TransformHandler] tryStart handle:',
      handle,
      'anchor:',
      anchorCorner,
    );

    for (const el of currentSelected) {
      const startMatrix = new DOMMatrix(el.transform.matrix.toString());
      this.startMatrices.set(el.id, startMatrix);

      const localBBox = this.getLocalBBox(el);
      const anchorGlobal = this.getCornerGlobal(
        localBBox,
        startMatrix,
        anchorCorner,
      );
      this.anchorWorldPoints.set(el.id, anchorGlobal);

      console.log(
        '[TransformHandler] element:',
        el.id,
        'localBBox:',
        localBBox,
        'matrix:',
        startMatrix.toString(),
      );
    }

    this._active = true;
    this.onTransformStart?.('resize');
    return true;
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;
    const totalDx = worldPoint.x - this.startWorldPoint.x;
    const totalDy = worldPoint.y - this.startWorldPoint.y;
    console.log(
      '[TransformHandler] move handle:',
      this.handle,
      'worldPt:',
      worldPoint,
      'totalDx:',
      totalDx.toFixed(2),
      'totalDy:',
      totalDy.toFixed(2),
    );
    this.applyResize(totalDx, totalDy);
    this.onTransformMove?.();
  }

  public end(): void {
    if (!this._active) return;
    console.log('[TransformHandler] end handle:', this.handle);
    this._active = false;
    for (const el of this.targets) {
      el.buildHitArea();
      el.setDirtyAll();
    }
    this.startMatrices.clear();
    this.anchorWorldPoints.clear();
    this.onTransformEnd?.('resize');
  }

  public abort(): void {
    this._active = false;
    this.startMatrices.clear();
    this.anchorWorldPoints.clear();
  }

  private applyResize(totalDx: number, totalDy: number): void {
    const anchorCorner = HANDLE_TO_ANCHOR[this.handle];

    for (const el of this.targets) {
      const startMatrix = this.startMatrices.get(el.id);
      const anchorWorld = this.anchorWorldPoints.get(el.id);
      if (!startMatrix || !anchorWorld) continue;

      const localBBox = this.getLocalBBox(el);
      const s = this.extractScale(startMatrix);
      const angleRad = Math.atan2(startMatrix.b, startMatrix.a);

      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const rawDx = totalDx * cos + totalDy * sin;
      const rawDy = -totalDx * sin + totalDy * cos;

      const localAnchor = startMatrix
        .inverse()
        .transformPoint({ x: anchorWorld.x, y: anchorWorld.y });

      const isRightAnchor = anchorCorner.includes('e');
      const isBottomAnchor = anchorCorner.includes('s');

      const effectiveW = isRightAnchor
        ? localAnchor.x - localBBox.x
        : localBBox.x + localBBox.width - localAnchor.x;
      const effectiveH = isBottomAnchor
        ? localAnchor.y - localBBox.y
        : localBBox.y + localBBox.height - localAnchor.y;

      if (effectiveW <= 0 || effectiveH <= 0 || s.sx <= 0 || s.sy <= 0)
        continue;

      const scaleDx = rawDx / s.sx;
      const scaleDy = rawDy / s.sy;

      const flip = HANDLE_FLIP[this.handle] ?? { x: 1, y: 1 };
      const localDx = scaleDx * flip.x;
      const localDy = scaleDy * flip.y;

      const factorX = 1 + localDx / effectiveW;
      const factorY = 1 + localDy / effectiveH;
      if (factorX <= 0 || factorY <= 0) continue;

      const m = new DOMMatrix(startMatrix.toString())
        .translateSelf(localAnchor.x, localAnchor.y)
        .scaleSelf(factorX, factorY)
        .translateSelf(-localAnchor.x, -localAnchor.y);

      el.transform.matrix = m;
      el.setDirtyTransform();
    }
  }

  private getLocalBBox(el: AbstractGraphicElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const ha = el.hitArea;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of ha) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private getCornerGlobal(
    bbox: { x: number; y: number; width: number; height: number },
    matrix: DOMMatrix,
    corner: HandlePosition,
  ): Point {
    const cx = corner.includes('e')
      ? bbox.x + bbox.width
      : corner.includes('w')
        ? bbox.x
        : bbox.x + bbox.width / 2;
    const cy = corner.includes('s')
      ? bbox.y + bbox.height
      : corner.includes('n')
        ? bbox.y
        : bbox.y + bbox.height / 2;
    return matrix.transformPoint({ x: cx, y: cy });
  }

  private extractScale(matrix: DOMMatrix): { sx: number; sy: number } {
    const sx =
      Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) *
      (matrix.a < 0 ? -1 : 1);
    const sy =
      Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d) *
      (matrix.d < 0 ? -1 : 1);
    return { sx, sy };
  }
}
