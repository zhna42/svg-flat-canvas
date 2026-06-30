import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox, PathCommand } from '@/types';
import { parseD, commandsToString } from '@/utils/path-utils';
import { getRenderQueue } from '@/utils/render-queue-utils';

export class PreviewElement extends AbstractGraphicElement {
  public geometry = {
    commands: [] as PathCommand[],
  };

  constructor(id: string) {
    super(id, 'path');
    this.isPreview = true;
  }

  public get d(): string {
    return commandsToString(this.geometry.commands);
  }

  public set d(val: string) {
    this.geometry.commands = parseD(val);
    this.markRenderKey('d');
  }

  public get hitArea(): Point[] {
    return [];
  }

  public buildHitArea(): void {}

  public toSegmentPolygons(): Point[][] {
    return [];
  }

  public getBBox(): BoundingBox {
    const allPts: Point[] = [];
    for (const cmd of this.geometry.commands) {
      if (cmd.command === 'M' || cmd.command === 'L') {
        allPts.push({ x: cmd.args[0], y: cmd.args[1] });
      } else if (cmd.command === 'C') {
        allPts.push({ x: cmd.args[0], y: cmd.args[1] });
        allPts.push({ x: cmd.args[4], y: cmd.args[5] });
      } else if (cmd.command === 'Q') {
        allPts.push({ x: cmd.args[0], y: cmd.args[1] });
        allPts.push({ x: cmd.args[2], y: cmd.args[3] });
      }
    }
    if (allPts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const pt of allPts) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
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
    if (typeof data.d === 'string') this.geometry.commands = parseD(data.d);
  }

  protected copyGeometryTo(_clone: AbstractGraphicElement): void {}

  public flattenTransformToAttrs(): void {}

  protected flattenTranslateDelta(_dx: number, _dy: number): void {}

  public toOutlinePath(): import('./PathElement').PathElement {
    const { PathElement: PE } = require('./PathElement');
    return new PE(`${this.id}-outline`);
  }

  public requestRender(): void {
    getRenderQueue()?.add(this);
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.style.visible = v;
    this.markRenderKeys('visible', 'style.visible');
    getRenderQueue()?.add(this);
  }
}
