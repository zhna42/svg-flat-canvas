import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { Point, PathNodeActivation } from '@/core/type';
import { PathElement } from '@/core/shapes/elements/PathElement';
import type { PathTimeMachine } from '@/core/shapes/path/PathTimeMachine';

export class PathNodeHandler {
  private active: PathNodeActivation | null = null;
  public pathTimeMachine: PathTimeMachine | null = null;

  public onNodeDragStart: ((el: AbstractGraphicElement) => void) | null = null;
  public onNodeDragEnd: (() => void) | null = null;
  public onNodeActivate: ((cmdIdx: number) => void) | null = null;

  public constructor() {}

  public get isActive(): boolean {
    return this.active !== null;
  }

  public get activation(): PathNodeActivation | null {
    return this.active;
  }

  public startFromHandle(
    elementId: string,
    cmdIdx: number,
    ptIdx: number,
    elements: AbstractGraphicElement[],
    worldPoint: Point,
  ): boolean {
    const el = elements.find((e) => e.id === elementId);
    if (!el || !(el instanceof PathElement)) return false;

    this.onNodeDragStart?.(el);

    const cmds = el.geometry.commands.map((c) => ({
      ...c,
      args: [...c.args],
    }));

    this.active = {
      element: el,
      cmdIdx,
      ptIdx,
      startMouseWorld: { x: worldPoint.x, y: worldPoint.y },
      startCommands: cmds,
      lastMouseWorld: { x: worldPoint.x, y: worldPoint.y },
    };

    this.onNodeActivate?.(cmdIdx);

    return true;
  }

  public move(worldPoint: Point): void {
    if (!this.active) return;

    const frameDx = worldPoint.x - this.active.lastMouseWorld.x;
    const frameDy = worldPoint.y - this.active.lastMouseWorld.y;
    this.active.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };

    const path = this.active.element;
    const cmd = path.geometry.commands[this.active.cmdIdx];
    if (!cmd) return;

    const idx = this.active.ptIdx;
    if (idx >= 0 && idx + 1 < cmd.args.length) {
      cmd.args[idx] += frameDx;
      cmd.args[idx + 1] += frameDy;
    }

    path.rebuildHitArea();
  }

  public end(): void {
    if (!this.active) return;

    const path = this.active.element;
    const newCommands = path.geometry.commands.map((c) => ({
      ...c,
      args: [...c.args],
    }));

    this.active = null;

    path.geometry.commands = newCommands;
    path.rebuildHitArea();

    this.pathTimeMachine?.capture();

    this.onNodeDragEnd?.();
    this.onNodeActivate?.(-1);
  }

  public abort(): void {
    if (!this.active) return;

    this.active = null;
    this.pathTimeMachine?.undo();

    this.onNodeActivate?.(-1);
  }
}
