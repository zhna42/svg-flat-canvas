import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/canvas/Camera';
import type { TimeMachine } from '@/manager/time-machine/TimeMachine';
import type {
  Point,
  GroupTransformMode,
  GroupHandlePosition,
} from '@/core/type';
import type { Group } from '@/core/shapes/group/Group';

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
  private snapRotation = false;
  private rotationStep = 15;
  private handle: GroupHandlePosition = 'se';
  private elements: AbstractGraphicElement[] = [];
  private startMatrices = new Map<string, DOMMatrix>();
  private groupStartOBB = { x: 0, y: 0, width: 0, height: 0, angle: 0 };
  private rotationCenter: Point = { x: 0, y: 0 };
  private startAngle = 0;
  private startWorldPoint: Point = { x: 0, y: 0 };
  private timeMachine: TimeMachine;
  private groups: Group[] = [];

  public onTransformStart: ((mode: GroupTransformMode) => void) | null = null;
  public onTransformMove: (() => void) | null = null;
  public onTransformEnd: ((mode: GroupTransformMode) => void) | null = null;

  public constructor(camera: Camera, timeMachine: TimeMachine) {
    void camera;
    this.timeMachine = timeMachine;
  }

  public get isActive(): boolean {
    return this._active;
  }

  public get selectedGroups(): readonly Group[] {
    return this.groups;
  }

  public setMode(mode: GroupTransformMode): void {
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
    handle: GroupHandlePosition,
    groupOBB: {
      x: number;
      y: number;
      width: number;
      height: number;
      angle: number;
    },
    worldPoint: { x: number; y: number },
    groups: readonly Group[],
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): boolean {
    if (groups.length === 0) return false;

    this.groups = Array.from(groups);
    this.handle = handle;
    this.startWorldPoint = { x: worldPoint.x, y: worldPoint.y };
    this.groupStartOBB = {
      x: groupOBB.x,
      y: groupOBB.y,
      width: groupOBB.width,
      height: groupOBB.height,
      angle: groupOBB.angle,
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

    const obbCx = groupOBB.x + groupOBB.width / 2;
    const obbCy = groupOBB.y + groupOBB.height / 2;

    if (this.mode === 'rotate') {
      this.rotationCenter = { x: obbCx, y: obbCy };
      this.startAngle =
        Math.atan2(
          worldPoint.y - this.rotationCenter.y,
          worldPoint.x - this.rotationCenter.x,
        ) *
        (180 / Math.PI);
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
        delta = Math.round(delta / this.rotationStep) * this.rotationStep;
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
    }

    const ids = this.elements.map((e) => e.id);
    this.timeMachine.push(
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
    const obb = this.groupStartOBB;
    const cx = obb.x + obb.width / 2;
    const cy = obb.y + obb.height / 2;

    for (const el of this.elements) {
      const startMatrix = this.startMatrices.get(el.id);
      if (!startMatrix) continue;
      const inv = startMatrix.inverse();
      const localCenter = inv.transformPoint({ x: cx, y: cy });
      el.transform.applyRotate(deltaAngle, localCenter, startMatrix);
    }

    const startAngle = obb.angle;
    const newAngle = startAngle + deltaAngle;

    const m = new DOMMatrix()
      .translateSelf(cx, cy)
      .rotateSelf(deltaAngle)
      .translateSelf(-cx, -cy);

    for (const g of this.groups) {
      g.matrix = m;
      g.obbAngle = newAngle;
    }
  }

  private applyResize(totalDx: number, totalDy: number): void {
    const obb = this.groupStartOBB;
    if (obb.width <= 0 || obb.height <= 0) return;

    const angleRad = (obb.angle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const projX = totalDx * cos + totalDy * sin;
    const projY = -totalDx * sin + totalDy * cos;

    const flip = HANDLE_FLIP[this.handle] ?? { x: 1, y: 1 };
    let scaleX = 1 + (projX * flip.x) / obb.width;
    let scaleY = 1 + (projY * flip.y) / obb.height;

    if (this.proportionalResize) {
      const absDX = Math.abs(scaleX - 1);
      const absDY = Math.abs(scaleY - 1);
      scaleX = absDX >= absDY ? scaleX : scaleY;
      scaleY = scaleX;
    }

    if (scaleX <= 0 || scaleY <= 0) return;

    const anchorHandle = HANDLE_TO_ANCHOR[this.handle];
    const anchorLocal = this.getCornerLocal(
      anchorHandle,
      obb.width,
      obb.height,
    );

    const M_obb2world = new DOMMatrix()
      .translate(obb.x, obb.y)
      .rotate(0, 0, obb.angle);
    const S_local = new DOMMatrix()
      .translate(anchorLocal.x, anchorLocal.y)
      .scale(scaleX, scaleY)
      .translate(-anchorLocal.x, -anchorLocal.y);
    const M_obb2world_inv = M_obb2world.inverse();
    const M_world_scale =
      M_obb2world.multiply(S_local).multiply(M_obb2world_inv);

    for (const el of this.elements) {
      const startMatrix = this.startMatrices.get(el.id);
      if (!startMatrix) continue;
      el.transform.matrix = M_world_scale.multiply(startMatrix);
    }
  }

  private getCornerLocal(
    corner: GroupHandlePosition,
    w: number,
    h: number,
  ): Point {
    const cx = corner.includes('e') ? w : corner.includes('w') ? 0 : w / 2;
    const cy = corner.includes('s') ? h : corner.includes('n') ? 0 : h / 2;
    return { x: cx, y: cy };
  }
}
