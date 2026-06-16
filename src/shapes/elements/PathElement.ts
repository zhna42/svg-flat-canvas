import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox, PathCommand } from '@/types';
import { PathHitArea } from '../modules/HitArea';
import {
  parseD,
  commandsToString,
  flattenCommands,
  transformCommands,
} from '../modules/path-utils';

interface ParsedPath {
  commands: PathCommand[];
}

export class PathElement extends AbstractGraphicElement {
  private _ha = new PathHitArea();
  private _parsed: ParsedPath = { commands: [] };
  private _parsedValid = false;

  public d = '';

  public constructor(id: string) {
    super(id, 'path');
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

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
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
    const m = this.transform.matrix;
    if (m.isIdentity) return;
    this.d = commandsToString(transformCommands(this.parsedD.commands, m));
    this.transform.reset();
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
