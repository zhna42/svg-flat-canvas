import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox, PathCommand } from '@/types';
import { PathHitArea } from '../modules/HitArea';
import {
  commandsToString,
  flattenCommands,
  parseD,
  transformCommands,
} from '@/utils/path-utils';

export interface NodeEditPoint {
  x: number;
  y: number;
  type: 'anchor' | 'control';
  cmdIdx: number;
  ptIdx: number;
  parentAnchor?: { x: number; y: number };
}

export class PathElement extends AbstractGraphicElement {
  private _ha = new PathHitArea();

  public geometry = {
    commands: [] as PathCommand[],
  };

  public constructor(id: string) {
    super(id, 'path');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public get commands(): PathCommand[] {
    return this.geometry.commands;
  }

  public set commands(cmds: PathCommand[]) {
    this.geometry.commands = cmds;
  }

  public buildHitArea(): void {
    const cmds = this.geometry.commands;
    if (cmds.length === 0) return;
    const flat = flattenCommands(cmds);
    const isClosed =
      cmds.length > 0 &&
      (cmds[cmds.length - 1].command === 'Z' ||
        cmds[cmds.length - 1].command === 'z');
    this._ha.set(flat, this.style.strokeWidth, this.style.hasFill, isClosed);
  }

  public getBBox(): BoundingBox {
    const pts = this.hitArea;
    if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { d: this.toDString() };
  }

  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      commands: this.geometry.commands.map((c) => ({
        ...c,
        args: [...c.args],
      })),
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.commands !== undefined) {
      this.geometry.commands = (data.commands as PathCommand[]).map((c) => ({
        ...c,
        args: [...c.args],
      }));
    }
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as PathElement;
    el.geometry.commands = this.geometry.commands.map((c) => ({
      ...c,
      args: [...c.args],
    }));
    el.buildHitArea();
  }

  public get d(): string {
    return this.toDString();
  }

  public set d(val: string) {
    this.geometry.commands = parseD(val);
    this.buildHitArea();
  }

  public toDString(): string {
    return commandsToString(this.geometry.commands);
  }

  public applyMatrixToD(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void {
    const m = new DOMMatrix([a, b, c, d, e, f]);
    this.geometry.commands = transformCommands(this.geometry.commands, m);
    this.invalidateHitArea();
  }

  public flattenTransform(): void {
    const m = this.transform.matrix;
    if (m.isIdentity) return;
    this.geometry.commands = transformCommands(this.geometry.commands, m);
    this.transform.reset();
    this.invalidateHitArea();
  }

  public flattenTransformToAttrs(): void {
    this.flattenTransform();
  }
  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.applyMatrixToD(1, 0, 0, 1, dx, dy);
  }

  public getNodeEditPoints(): NodeEditPoint[] {
    const result: NodeEditPoint[] = [];
    const cmds = this.geometry.commands;
    let prevAnchor: Point | null = null;

    for (let cmdIdx = 0; cmdIdx < cmds.length; cmdIdx++) {
      const cmd = cmds[cmdIdx];
      const c = cmd.command.toUpperCase();

      if (c === 'M') {
        if (cmd.args.length >= 2) {
          const world = this.transformPoint({
            x: cmd.args[0],
            y: cmd.args[1],
          });
          result.push({
            x: world.x,
            y: world.y,
            type: 'anchor',
            cmdIdx,
            ptIdx: 0,
          });
          prevAnchor = world;
        }
      } else if (c === 'L') {
        if (cmd.args.length >= 2) {
          const world = this.transformPoint({
            x: cmd.args[0],
            y: cmd.args[1],
          });
          result.push({
            x: world.x,
            y: world.y,
            type: 'anchor',
            cmdIdx,
            ptIdx: 0,
          });
          prevAnchor = world;
        }
      } else if (c === 'C' && cmd.args.length >= 6) {
        const endWorld = this.transformPoint({
          x: cmd.args[4],
          y: cmd.args[5],
        });
        const control1World = this.transformPoint({
          x: cmd.args[0],
          y: cmd.args[1],
        });
        const control2World = this.transformPoint({
          x: cmd.args[2],
          y: cmd.args[3],
        });

        // Control 1 — привязан к предыдущему anchor
        if (prevAnchor) {
          result.push({
            x: control1World.x,
            y: control1World.y,
            type: 'control',
            cmdIdx,
            ptIdx: 0,
            parentAnchor: { x: prevAnchor.x, y: prevAnchor.y },
          });
        }

        // Control 2 — привязан к конечному anchor
        result.push({
          x: control2World.x,
          y: control2World.y,
          type: 'control',
          cmdIdx,
          ptIdx: 2,
          parentAnchor: { x: endWorld.x, y: endWorld.y },
        });

        // Anchor — конечная точка C
        result.push({
          x: endWorld.x,
          y: endWorld.y,
          type: 'anchor',
          cmdIdx,
          ptIdx: 4,
        });
        prevAnchor = endWorld;
      } else if (c === 'Q' && cmd.args.length >= 4) {
        const endWorld = this.transformPoint({
          x: cmd.args[2],
          y: cmd.args[3],
        });
        const controlWorld = this.transformPoint({
          x: cmd.args[0],
          y: cmd.args[1],
        });

        if (prevAnchor) {
          result.push({
            x: controlWorld.x,
            y: controlWorld.y,
            type: 'control',
            cmdIdx,
            ptIdx: 0,
            parentAnchor: { x: prevAnchor.x, y: prevAnchor.y },
          });
        }

        result.push({
          x: endWorld.x,
          y: endWorld.y,
          type: 'anchor',
          cmdIdx,
          ptIdx: 2,
        });
        prevAnchor = endWorld;
      } else if (c === 'S' && cmd.args.length >= 4) {
        const controlWorld = this.transformPoint({
          x: cmd.args[0],
          y: cmd.args[1],
        });
        const endWorld = this.transformPoint({
          x: cmd.args[2],
          y: cmd.args[3],
        });

        if (prevAnchor) {
          result.push({
            x: controlWorld.x,
            y: controlWorld.y,
            type: 'control',
            cmdIdx,
            ptIdx: 0,
            parentAnchor: { x: prevAnchor.x, y: prevAnchor.y },
          });
        }

        result.push({
          x: endWorld.x,
          y: endWorld.y,
          type: 'anchor',
          cmdIdx,
          ptIdx: 2,
        });
        prevAnchor = endWorld;
      } else if (c === 'T' && cmd.args.length >= 2) {
        const endWorld = this.transformPoint({
          x: cmd.args[0],
          y: cmd.args[1],
        });

        result.push({
          x: endWorld.x,
          y: endWorld.y,
          type: 'anchor',
          cmdIdx,
          ptIdx: 0,
        });
        prevAnchor = endWorld;
      }
    }
    return result;
  }
}
