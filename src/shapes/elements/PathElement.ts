import { SvgElement } from './SvgElement';
import type { Point, BoundingBox, PathCommand } from '@/types';
import { PathHitArea } from '../modules/HitArea';
import {
  parseD,
  commandsToString,
  flattenCommands,
  transformCommands,
  applyMatrixToPoint,
} from '../modules/path-utils';

interface ParsedPath {
  commands: PathCommand[];
}

export class PathElement extends SvgElement {
  private _ha = new PathHitArea();
  private _parsed: ParsedPath = { commands: [] };
  private _parsedValid = false;

  public d = '';

  public constructor(id: string) {
    super(id, 'path', 'path');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public get parsedD(): ParsedPath {
    if (!this._parsedValid) {
      this._parsed = { commands: parseD(this.d) };
      this._parsedValid = true;
    }
    return this._parsed;
  }

  public buildHitArea(): void {
    const cmds = this.parsedD.commands;
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
    return { d: this.d };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return { d: this.d };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.d !== undefined) {
      this.d = data.d as string;
      this._parsedValid = false;
    }
    this.buildHitArea();
  }

  protected copyGeometryTo(clone: SvgElement): void {
    const el = clone as PathElement;
    el.d = this.d;
    el._parsedValid = false;
    el.buildHitArea();
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
    this.d = commandsToString(transformCommands(this.parsedD.commands, m));
    this._parsedValid = false;
    this.invalidateHitArea();
  }

  public flattenTransform(): void {
    const transform = this.element.getAttribute('transform');
    if (!transform) return;
    const graphicsEl = this.element as SVGGraphicsElement;
    const bbox = graphicsEl.getBBox();
    if (bbox.width === 0 && bbox.height === 0) return;
    const svg = this.element.ownerSVGElement;
    if (!svg) return;
    const ctm = graphicsEl.getCTM();
    if (!ctm) return;
    this.d = commandsToString(
      this.parsedD.commands.map((cmd) => {
        if (cmd.command === 'M' || cmd.command === 'L') {
          const pt = applyMatrixToPoint(ctm, cmd.args[0], cmd.args[1]);
          return { command: cmd.command, args: [pt.x, pt.y] };
        }
        if (cmd.command === 'H') {
          const pt = applyMatrixToPoint(ctm, cmd.args[0], 0);
          return { command: 'L', args: [pt.x, pt.y] };
        }
        if (cmd.command === 'V') {
          const pt = applyMatrixToPoint(ctm, 0, cmd.args[0]);
          return { command: 'L', args: [pt.x, pt.y] };
        }
        if (cmd.command === 'C') {
          const p1 = applyMatrixToPoint(ctm, cmd.args[0], cmd.args[1]);
          const p2 = applyMatrixToPoint(ctm, cmd.args[2], cmd.args[3]);
          const p3 = applyMatrixToPoint(ctm, cmd.args[4], cmd.args[5]);
          return { command: 'C', args: [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y] };
        }
        if (cmd.command === 'S') {
          const p1 = applyMatrixToPoint(ctm, cmd.args[0], cmd.args[1]);
          const p2 = applyMatrixToPoint(ctm, cmd.args[2], cmd.args[3]);
          return { command: 'S', args: [p1.x, p1.y, p2.x, p2.y] };
        }
        if (cmd.command === 'Q') {
          const p1 = applyMatrixToPoint(ctm, cmd.args[0], cmd.args[1]);
          const p2 = applyMatrixToPoint(ctm, cmd.args[2], cmd.args[3]);
          return { command: 'Q', args: [p1.x, p1.y, p2.x, p2.y] };
        }
        if (cmd.command === 'T') {
          const pt = applyMatrixToPoint(ctm, cmd.args[0], cmd.args[1]);
          return { command: 'T', args: [pt.x, pt.y] };
        }
        if (cmd.command === 'A') {
          const pt = applyMatrixToPoint(ctm, cmd.args[5], cmd.args[6]);
          return {
            command: 'A',
            args: [
              cmd.args[0],
              cmd.args[1],
              cmd.args[2],
              cmd.args[3],
              cmd.args[4],
              pt.x,
              pt.y,
            ],
          };
        }
        if (cmd.command === 'Z' || cmd.command === 'z') return cmd;
        return cmd;
      }),
    );
    this.element.removeAttribute('transform');
    this._parsedValid = false;
    this.invalidateHitArea();
  }

  public flattenTransformToAttrs(): void {
    this.flattenTransform();
  }
  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.applyMatrixToD(1, 0, 0, 1, dx, dy);
  }
}
