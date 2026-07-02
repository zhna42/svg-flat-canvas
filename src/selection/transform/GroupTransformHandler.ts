import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/camera/Camera';
import type { CommandBus } from '@/commands/CommandBus';
import type { Point } from '@/types';
import type { Group } from '@/group/Group';
import { getRenderQueue } from '@/utils/render-queue-utils';

export type GroupTransformMode = 'resize' | 'rotate';

export type GroupHandlePosition =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

const HANDLE_TO_ANCHOR: Record<GroupHandlePosition, GroupHandlePosition> = {
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

export class GroupTransformHandler {
  private _active = false;
  private mode: GroupTransformMode = 'resize';
  private proportionalResize = false;
  private handle: GroupHandlePosition = 'se';
  private elements: AbstractGraphicElement[] = [];
  private startMatrices = new Map<string, DOMMatrix>();
  private groupStartBBox = { x: 0, y: 0, width: 0, height: 0 };
  private rotationCenter: Point = { x: 0, y: 0 };
  private startAngle = 0;
  private startWorldPoint: Point = { x: 0, y: 0 };
  private currentAngle = 0;
  private bus: CommandBus;

  public onTransformStart: ((mode: GroupTransformMode) => void) | null = null;
  public onTransformMove: (() => void) | null = null;
  public onTransformEnd: ((mode: GroupTransformMode) => void) | null = null;

  public constructor(camera: Camera, bus: CommandBus) {
    void camera;
    this.bus = bus;
  }

  public get isActive(): boolean {
    return this._active;
  }

  public get rotationAngle(): number {
    return this.currentAngle;
  }

  public setMode(mode: GroupTransformMode): void {
    this.mode = mode;
  }

  public setProportionalResize(enabled: boolean): void {
    this.proportionalResize = enabled;
  }

  public tryStart(
    handle: GroupHandlePosition,
    groupBBox: { x: number; y: number; width: number; height: number },
    worldPoint: { x: number; y: number },
    groups: readonly Group[],
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): boolean {
    if (groups.length === 0) return false;

    this.handle = handle;
    this.startWorldPoint = { x: worldPoint.x, y: worldPoint.y };
    this.groupStartBBox = {
      x: groupBBox.x,
      y: groupBBox.y,
      width: groupBBox.width,
      height: groupBBox.height,
    };

    const elementSet = new Set<string>();
    for (const g of groups) {
      for (const eid of g.elementIds) {
        elementSet.add(eid);
      }
    }

    this.elements = [];
    this.startMatrices.clear();
    for (const id of elementSet) {
      const el = findElement(id);
      if (!el) continue;
      this.elements.push(el);
      this.startMatrices.set(
        el.id,
        new DOMMatrix(el.transform.matrix.toString()),
      );
    }

    if (this.elements.length === 0) return false;

    this.currentAngle = 0;

    if (this.mode === 'rotate') {
      this.rotationCenter = {
        x: groupBBox.x + groupBBox.width / 2,
        y: groupBBox.y + groupBBox.height / 2,
      };
      this.startAngle =
        Math.atan2(
          worldPoint.y - this.rotationCenter.y,
          worldPoint.x - this.rotationCenter.x,
        ) * (180 / Math.PI);
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
        ) * (180 / Math.PI);
      let delta = currentAngle - this.startAngle;
      this.currentAngle = delta;
      if (shiftHeld) {
        delta = Math.round(delta / 15) * 15;
      }
      this.applyRotate(delta);
    } else {
      const totalDx = worldPoint.x - this.startWorldPoint.x;
      const totalDy = worldPoint.y - this.startWorldPoint.y;
      this.applyResize(totalDx, totalDy);
    }

    this.onTransformMove?.();
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;

    for (const el of this.elements) {
      el.rebuildHitArea();
      getRenderQueue()?.add(el);
    }

    const ids = this.elements.map((e) => e.id);
    this.bus
      .getTimeMachine()
      .push(
        this.mode === 'rotate' ? 'ROTATE' : 'RESIZE',
        ids,
        'group',
        [],
        this.elements,
      );

    this.startMatrices.clear();
    this.elements = [];
    this.onTransformEnd?.(this.mode);
  }

  public abort(): void {
    this._active = false;
    this.startMatrices.clear();
    this.elements = [];
  }

  private applyRotate(deltaAngle: number): void {
    for (const el of this.elements) {
      const startMatrix = this.startMatrices.get(el.id);
      if (!startMatrix) continue;
      const inv = startMatrix.inverse();
      const localCenter = inv.transformPoint({
        x: this.rotationCenter.x,
        y: this.rotationCenter.y,
      });
      el.transform.applyRotate(deltaAngle, localCenter, startMatrix);
      getRenderQueue()?.add(el);
    }
  }

  private applyResize(totalDx: number, totalDy: number): void {
    const startBBox = this.groupStartBBox;
    if (startBBox.width <= 0 || startBBox.height <= 0) return;

    const flip = HANDLE_FLIP[this.handle] ?? { x: 1, y: 1 };
    const scaleX = 1 + (totalDx * flip.x) / startBBox.width;
    const scaleY = 1 + (totalDy * flip.y) / startBBox.height;

    const anchorCorner = HANDLE_TO_ANCHOR[this.handle];

    const fixedCorner = this.getCornerGlobal(startBBox, anchorCorner);

    let usedScaleX = scaleX;
    let usedScaleY = scaleY;
    if (this.proportionalResize) {
      const absDX = Math.abs(scaleX - 1);
      const absDY = Math.abs(scaleY - 1);
      usedScaleX = absDX >= absDY ? scaleX : scaleY;
      usedScaleY = usedScaleX;
    }

    if (usedScaleX <= 0 || usedScaleY <= 0) return;

    for (const el of this.elements) {
      const startMatrix = this.startMatrices.get(el.id);
      if (!startMatrix) continue;

      const center = startMatrix.transformPoint(el.getLocalCenter());

      const relX = (center.x - fixedCorner.x) * usedScaleX;
      const relY = (center.y - fixedCorner.y) * usedScaleY;
      const newCenterX = fixedCorner.x + relX;
      const newCenterY = fixedCorner.y + relY;

      const localCenter = el.getLocalCenter();
      const s = this.extractScale(startMatrix);
      if (s.sx <= 0 || s.sy <= 0) continue;

      const newMatrix = new DOMMatrix(startMatrix.toString());
      newMatrix.e = newCenterX - localCenter.x * usedScaleX;
      newMatrix.f = newCenterY - localCenter.y * usedScaleY;
      newMatrix.a *= usedScaleX / s.sx;
      newMatrix.b *= usedScaleX / s.sx;
      newMatrix.c *= usedScaleY / s.sy;
      newMatrix.d *= usedScaleY / s.sy;

      el.transform.matrix = newMatrix;
      getRenderQueue()?.add(el);
    }
  }

  private getCornerGlobal(
    bbox: { x: number; y: number; width: number; height: number },
    corner: GroupHandlePosition,
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
    return { x: cx, y: cy };
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
