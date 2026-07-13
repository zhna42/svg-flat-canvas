import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { HandlePosition, Point, TransformMode } from '@/core/type';
import type { Camera } from '@/canvas/Camera';
import type { TimeMachine } from '@/manager/time-machine/TimeMachine';

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
  private mode: TransformMode = 'resize';
  private proportionalResize = false;
  private snapRotation = false;
  private rotationStep = 15;
  private handle: HandlePosition = 'se';
  private targets: AbstractGraphicElement[] = [];
  private startWorldPoint: Point = { x: 0, y: 0 };
  private startMatrices = new Map<string, DOMMatrix>();
  private anchorWorldPoints = new Map<string, Point>();
  private startTextBoxes = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
  private rotationCenter: Point = { x: 0, y: 0 };
  private startAngle = 0;
  private timeMachine: TimeMachine;

  public onTransformStart: ((mode: TransformMode) => void) | null = null;
  public onTransformMove: (() => void) | null = null;
  public onTransformEnd: ((mode: TransformMode) => void) | null = null;

  public constructor(_camera: Camera, timeMachine: TimeMachine) {
    this.timeMachine = timeMachine;
  }

  public get isActive(): boolean {
    return this._active;
  }

  public setMode(mode: TransformMode): void {
    this.mode = mode;
  }

  public setProportionalResize(enabled: boolean): void {
    this.proportionalResize = enabled;
  }

  public setSnapRotation(enabled: boolean): void {
    this.snapRotation = enabled;
  }

  public setRotationStep(step: number): void {
    if (step > 0) this.rotationStep = step;
  }

  public tryStart(
    handle: HandlePosition,
    _bbox: DOMRect,
    _element: AbstractGraphicElement,
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): boolean {
    if (currentSelected.some((el) => el.type === 'use')) return false;

    this.handle = handle;
    this.targets = Array.from(currentSelected);
    this.startWorldPoint = { x: worldPoint.x, y: worldPoint.y };
    this.startMatrices.clear();
    this.anchorWorldPoints.clear();
    this.startTextBoxes.clear();

    for (const el of currentSelected) {
      const startMatrix = new DOMMatrix(el.transform.matrix.toString());
      this.startMatrices.set(el.id, startMatrix);
      if (el.type === 'text' && (el as { rich?: boolean }).rich) {
        const b = el.getBBox();
        this.startTextBoxes.set(el.id, {
          x: b.x,
          y: b.y,
          w: b.width,
          h: b.height,
        });
      }
    }

    if (this.mode === 'rotate') {
      let cx = 0;
      let cy = 0;
      let count = 0;
      for (const el of this.targets) {
        const sm = this.startMatrices.get(el.id);
        if (!sm) continue;
        const center = el.getCenter();
        cx += center.x;
        cy += center.y;
        count++;
      }
      if (count > 0) {
        this.rotationCenter = { x: cx / count, y: cy / count };
      }
      this.startAngle =
        Math.atan2(
          worldPoint.y - this.rotationCenter.y,
          worldPoint.x - this.rotationCenter.x,
        ) *
        (180 / Math.PI);
    } else {
      const anchorCorner = HANDLE_TO_ANCHOR[handle];
      for (const el of currentSelected) {
        const startMatrix = this.startMatrices.get(el.id)!;
        const localBBox = this.getLocalBBox(el);
        const anchorGlobal = this.getCornerGlobal(
          localBBox,
          startMatrix,
          anchorCorner,
        );
        this.anchorWorldPoints.set(el.id, anchorGlobal);
      }
    }

    this._active = true;
    this.onTransformStart?.(this.mode);
    return true;
  }

  public move(worldPoint: { x: number; y: number }, shiftHeld = false): void {
    if (!this._active) return;

    if (this.mode === 'rotate') {
      const currentAngle =
        Math.atan2(
          worldPoint.y - this.rotationCenter.y,
          worldPoint.x - this.rotationCenter.x,
        ) *
        (180 / Math.PI);
      let delta = currentAngle - this.startAngle;
      if (shiftHeld || this.snapRotation) {
        const step = this.rotationStep;
        delta = Math.round(delta / step) * step;
      }
      this.applyRotate(delta);
    } else {
      const totalDx = worldPoint.x - this.startWorldPoint.x;
      const totalDy = worldPoint.y - this.startWorldPoint.y;
      this.applyResize(totalDx, totalDy);
    }

    this.onTransformMove?.();
  }

  private applyRotate(deltaAngle: number): void {
    for (const el of this.targets) {
      const startMatrix = this.startMatrices.get(el.id);
      if (!startMatrix) continue;
      const localCenter = el.getLocalCenter();
      el.transform.applyRotate(deltaAngle, localCenter, startMatrix);
    }
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;
    for (const el of this.targets) {
      el.rebuildHitArea();
    }

    const ids = this.targets.map((e) => e.id);
    this.timeMachine.push(
      this.mode === 'rotate' ? 'ROTATE' : 'RESIZE',
      ids,
      'element',
      [],
      this.targets,
    );

    this.startMatrices.clear();
    this.anchorWorldPoints.clear();
    this.onTransformEnd?.(this.mode);
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

      const textBox = this.startTextBoxes.get(el.id);
      const factorX =
        1 + localDx / (textBox ? Math.max(textBox.w, 1) : effectiveW);
      const factorY =
        1 + localDy / (textBox ? Math.max(textBox.h, 1) : effectiveH);

      let usedFactorX = factorX;
      let usedFactorY = factorY;

      if (this.proportionalResize) {
        const absDX = Math.abs(factorX - 1);
        const absDY = Math.abs(factorY - 1);
        const dominantFactor = absDX >= absDY ? factorX : factorY;
        usedFactorX = dominantFactor;
        usedFactorY = dominantFactor;
      }

      if (usedFactorX <= 0 || usedFactorY <= 0) continue;

      if (textBox) {
        // Текст: меняем размер РАМКИ, шрифт не масштабируем.
        const newW = Math.max(textBox.w * usedFactorX, 1);
        const newH = Math.max(textBox.h * usedFactorY, 1);
        const newX = isRightAnchor ? textBox.x + textBox.w - newW : textBox.x;
        const newY = isBottomAnchor ? textBox.y + textBox.h - newH : textBox.y;
        const t = el as unknown as {
          posX: string;
          posY: string;
          setBox: (w: number, h: number) => void;
        };
        t.posX = String(newX);
        t.posY = String(newY);
        t.setBox(newW, newH);
        el.transform.matrix = new DOMMatrix(startMatrix.toString());
        continue;
      }

      const m = new DOMMatrix(startMatrix.toString())
        .translateSelf(localAnchor.x, localAnchor.y)
        .scaleSelf(usedFactorX, usedFactorY)
        .translateSelf(-localAnchor.x, -localAnchor.y);

      el.transform.matrix = m;
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
    const sx = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
    const sy = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
    return { sx, sy };
  }
}
