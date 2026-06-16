import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { PathElement } from '@/shapes/elements/PathElement';
import type { CommandBus } from '@/commands/CommandBus';
import type { Point, PathCommand } from '@/types';

export interface PathNodeActivation {
  element: PathElement;
  cmdIdx: number;
  ptIdx: number;
  startMouseWorld: Point;
  startCommands: PathCommand[];
  lastMouseWorld: Point;
}

export class PathNodeHandler {
  private bus: CommandBus;
  private active: PathNodeActivation | null = null;

  public onNodeDragStart: ((el: AbstractGraphicElement) => void) | null = null;
  public onNodeDragEnd: (() => void) | null = null;

  public constructor(bus: CommandBus) {
    this.bus = bus;
  }

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

    const c = cmd.command.toUpperCase();
    if (c === 'M' || c === 'L') {
      if (cmd.args.length >= 2) {
        cmd.args[0] += frameDx;
        cmd.args[1] += frameDy;
      }
    } else if (c === 'C' && cmd.args.length >= 6) {
      cmd.args[4] += frameDx;
      cmd.args[5] += frameDy;
    } else if (c === 'Q' && cmd.args.length >= 4) {
      cmd.args[2] += frameDx;
      cmd.args[3] += frameDy;
    }

    path.buildHitArea();
    path.setDirty();
  }

  public end(): void {
    if (!this.active) return;

    const path = this.active.element;
    const newCommands = path.geometry.commands.map((c) => ({
      ...c,
      args: [...c.args],
    }));

    path.geometry.commands = this.active.startCommands;
    path.buildHitArea();
    path.setDirty();

    this.bus.execute({
      type: 'GEOMETRY_MUTATE',
      options: { id: path.id, newCommands },
    });

    this.active = null;
    this.onNodeDragEnd?.();
  }

  public abort(): void {
    if (!this.active) return;

    const path = this.active.element;
    path.geometry.commands = this.active.startCommands;
    path.buildHitArea();
    path.setDirty();

    this.active = null;
  }
}
