import { AbstractGraphicElement } from './AbstractGraphicElement';
import type {
  Point,
  BoundingBox,
  PathCommand,
  PathSegment,
  NodeEditPoint,
  EditNodeModel,
  INodeEditable,
} from '@/core/type';
import {
  segmentsToCommands,
  commandsToSegments,
  segmentsToD,
} from '@/core/type';
import { PathHitArea } from '../modules/HitArea';
import { flattenCommands, parseD, transformCommands } from '@/core/math/path';
import {
  commandsToContours,
  contoursToCommands,
  mapContours,
} from '@/core/shapes/path/node-model';

export class PathElement
  extends AbstractGraphicElement
  implements INodeEditable
{
  _ha = new PathHitArea();
  public readonly supportsCurves = true;
  public isSimpleHitArea = false;
  public _suppressHitArea = false;

  public geometry = {
    segments: [] as PathSegment[],
  };

  public constructor(id: string) {
    super(id, 'path');
    this.subscribeGeometry('geometry.segments');
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    if (this._suppressHitArea) return;
    const segs = this.geometry.segments;
    if (segs.length === 0) return;

    if (this.isSimpleHitArea || segs.length > 100) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const s of segs) {
        if (s.type === 'Z') continue;
        const pts =
          s.type === 'C'
            ? [
                [s.c1x, s.c1y],
                [s.c2x, s.c2y],
                [s.x, s.y],
              ]
            : [
                [
                  (s as { x: number; y: number }).x,
                  (s as { x: number; y: number }).y,
                ],
              ];
        for (const [cx, cy] of pts) {
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        }
      }
      if (minX > maxX || minY > maxY) return;
      const isClosed = segs.length > 0 && segs[segs.length - 1].type === 'Z';
      this._ha.set(
        [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ],
        this.style.strokeWidth,
        this.style.hasFill,
        isClosed,
      );
      return;
    }

    const cmds = segmentsToCommands(segs);
    const flat = flattenCommands(cmds);
    const isClosed = segs.length > 0 && segs[segs.length - 1].type === 'Z';
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
      segments: this.geometry.segments.map((s) =>
        s.type === 'C'
          ? { ...s }
          : s.type === 'Z'
            ? { type: 'Z' as const }
            : { ...s },
      ),
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.segments !== undefined) {
      this.geometry.segments = (data.segments as PathSegment[]).map((s) =>
        s.type === 'C'
          ? { ...s }
          : s.type === 'Z'
            ? { type: 'Z' as const }
            : { ...s },
      );
    }
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as PathElement;
    el.geometry.segments = this.geometry.segments.map((s) =>
      s.type === 'C'
        ? { ...s }
        : s.type === 'Z'
          ? { type: 'Z' as const }
          : { ...s },
    );
    el.rebuildHitArea();
  }

  public get d(): string {
    return this.toDString();
  }

  public set d(val: string) {
    this.geometry.segments = commandsToSegments(parseD(val));
    this.rebuildHitArea();
  }

  public toDString(): string {
    return segmentsToD(this.geometry.segments);
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
    const cmds = segmentsToCommands(this.geometry.segments);
    this.geometry.segments = commandsToSegments(transformCommands(cmds, m));
    this.rebuildHitArea();
  }

  public flattenTransform(): void {
    const m = this.transform.matrix;
    if (m.isIdentity) return;
    const cmds = segmentsToCommands(this.geometry.segments);
    this.geometry.segments = commandsToSegments(transformCommands(cmds, m));
    this.transform.reset();
    this.rebuildHitArea();
  }

  public flattenTransformToAttrs(): void {
    this.flattenTransform();
  }
  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.applyMatrixToD(1, 0, 0, 1, dx, dy);
  }

  public getSubpathRanges(): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const segs = this.geometry.segments;
    let start = -1;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].type === 'M') {
        if (start >= 0) ranges.push({ start, end: i - 1 });
        start = i;
      }
    }
    if (start >= 0) ranges.push({ start, end: segs.length - 1 });
    return ranges;
  }

  private static splitCubic(
    P0x: number,
    P0y: number,
    P1x: number,
    P1y: number,
    P2x: number,
    P2y: number,
    P3x: number,
    P3y: number,
    t: number,
  ): {
    left: [number, number, number, number, number, number, number, number];
    right: [number, number, number, number, number, number, number, number];
  } {
    const A = { x: P0x + (P1x - P0x) * t, y: P0y + (P1y - P0y) * t };
    const B = { x: P1x + (P2x - P1x) * t, y: P1y + (P2y - P1y) * t };
    const C = { x: P2x + (P3x - P2x) * t, y: P2y + (P3y - P2y) * t };
    const D = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
    const E = { x: B.x + (C.x - B.x) * t, y: B.y + (C.y - B.y) * t };
    const F = { x: D.x + (E.x - D.x) * t, y: D.y + (E.y - D.y) * t };

    return {
      left: [P0x, P0y, A.x, A.y, D.x, D.y, F.x, F.y],
      right: [F.x, F.y, E.x, E.y, C.x, C.y, P3x, P3y],
    };
  }

  public addNodeAt(
    cmdIdx: number,
    x: number,
    y: number,
    t: number,
    prevEndX: number,
    prevEndY: number,
  ): void {
    const segs = this.geometry.segments;
    if (cmdIdx < 0 || cmdIdx >= segs.length) return;

    let nextSeg: PathSegment | null = null;
    for (let i = cmdIdx + 1; i < segs.length; i++) {
      if (segs[i].type !== 'Z') {
        nextSeg = segs[i];
        break;
      }
    }

    if (!nextSeg) {
      segs.splice(cmdIdx + 1, 0, { type: 'L', x, y });
      return;
    }

    if (nextSeg.type === 'C') {
      const sx = prevEndX;
      const sy = prevEndY;
      const { left, right } = PathElement.splitCubic(
        sx,
        sy,
        nextSeg.c1x,
        nextSeg.c1y,
        nextSeg.c2x,
        nextSeg.c2y,
        nextSeg.x,
        nextSeg.y,
        t,
      );
      nextSeg.c1x = left[2];
      nextSeg.c1y = left[3];
      nextSeg.c2x = left[4];
      nextSeg.c2y = left[5];
      nextSeg.x = left[6];
      nextSeg.y = left[7];
      segs.splice(cmdIdx + 1, 0, {
        type: 'C',
        c1x: right[2],
        c1y: right[3],
        c2x: right[4],
        c2y: right[5],
        x: right[6],
        y: right[7],
      });
    } else if (nextSeg.type === 'Q') {
      const A = {
        x: prevEndX + (nextSeg.cx - prevEndX) * t,
        y: prevEndY + (nextSeg.cy - prevEndY) * t,
      };
      const B = {
        x: nextSeg.cx + (nextSeg.x - nextSeg.cx) * t,
        y: nextSeg.cy + (nextSeg.y - nextSeg.cy) * t,
      };
      const F = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
      nextSeg.cx = A.x;
      nextSeg.cy = A.y;
      nextSeg.x = F.x;
      nextSeg.y = F.y;
      segs.splice(cmdIdx + 1, 0, {
        type: 'Q',
        cx: B.x,
        cy: B.y,
        x: nextSeg.x,
        y: nextSeg.y,
      });
    } else if (nextSeg.type === 'L') {
      segs.splice(cmdIdx + 1, 0, { type: 'L', x: nextSeg.x, y: nextSeg.y });
    } else {
      segs.splice(cmdIdx + 1, 0, { type: 'L', x, y });
    }
  }

  public changeNodeType(cmdIdx: number, newType: 'L' | 'C'): void {
    const seg = this.geometry.segments[cmdIdx];
    if (!seg) return;
    if (newType === 'L') {
      (seg as PathSegment).type = 'L';
      if (seg.type === 'C') {
        const c = seg as {
          c1x: number;
          c1y: number;
          c2x: number;
          c2y: number;
          x: number;
          y: number;
        };
        (seg as any).x = c.x;
        (seg as any).y = c.y;
        delete (seg as any).c1x;
        delete (seg as any).c1y;
        delete (seg as any).c2x;
        delete (seg as any).c2y;
      }
    } else if (newType === 'C') {
      const x = 'x' in seg ? (seg as { x: number }).x : 0;
      const y = 'y' in seg ? (seg as { y: number }).y : 0;
      const ns: any = {
        type: 'C',
        c1x: x - 25,
        c1y: y,
        c2x: x,
        c2y: y - 25,
        x,
        y,
      };
      this.geometry.segments[cmdIdx] = ns;
    }
  }

  public removeNodeAt(cmdIdx: number): void {
    const segs = this.geometry.segments;
    if (cmdIdx < 0 || cmdIdx >= segs.length) return;
    segs.splice(cmdIdx, 1);
    if (cmdIdx === 0 && segs.length > 0) {
      const s = segs[0];
      if (s.type !== 'Z' && s.type !== 'M')
        segs[0] = {
          type: 'M',
          x: 'x' in s ? (s as any).x : 0,
          y: 'y' in s ? (s as any).y : 0,
        };
    }
  }

  public translateSubpath(subpathIdx: number, dx: number, dy: number): void {
    const ranges = this.getSubpathRanges();
    if (subpathIdx < 0 || subpathIdx >= ranges.length) return;
    const { start, end } = ranges[subpathIdx];
    for (let i = start; i <= end; i++) {
      const s = this.geometry.segments[i];
      if (s.type === 'Z') continue;
      if (s.type === 'C') {
        s.c1x += dx;
        s.c1y += dy;
        s.c2x += dx;
        s.c2y += dy;
        s.x += dx;
        s.y += dy;
      } else if (s.type === 'Q') {
        s.cx += dx;
        s.cy += dy;
        s.x += dx;
        s.y += dy;
      } else {
        (s as { x: number; y: number }).x += dx;
        (s as { x: number; y: number }).y += dy;
      }
    }
  }

  public getNodeEditPoints(): NodeEditPoint[] {
    const result: NodeEditPoint[] = [];
    const segs = this.geometry.segments;
    let prevAnchor: Point | null = null;

    for (let ci = 0; ci < segs.length; ci++) {
      const s = segs[ci];

      if (s.type === 'M') {
        const world = this.transform.transformPoint({ x: s.x, y: s.y });
        result.push({
          x: world.x,
          y: world.y,
          type: 'anchor',
          cmdIdx: ci,
          ptIdx: 0,
        });
        prevAnchor = world;
      } else if (s.type === 'L') {
        const world = this.transform.transformPoint({ x: s.x, y: s.y });
        result.push({
          x: world.x,
          y: world.y,
          type: 'anchor',
          cmdIdx: ci,
          ptIdx: 0,
        });
        prevAnchor = world;
      } else if (s.type === 'C') {
        const endWorld = this.transform.transformPoint({ x: s.x, y: s.y });
        const c1World = this.transform.transformPoint({ x: s.c1x, y: s.c1y });
        const c2World = this.transform.transformPoint({ x: s.c2x, y: s.c2y });
        if (prevAnchor) {
          result.push({
            x: c1World.x,
            y: c1World.y,
            type: 'control',
            cmdIdx: ci,
            ptIdx: 0,
            parentAnchor: { x: prevAnchor.x, y: prevAnchor.y },
          });
        }
        result.push({
          x: c2World.x,
          y: c2World.y,
          type: 'control',
          cmdIdx: ci,
          ptIdx: 2,
          parentAnchor: { x: endWorld.x, y: endWorld.y },
        });
        result.push({
          x: endWorld.x,
          y: endWorld.y,
          type: 'anchor',
          cmdIdx: ci,
          ptIdx: 4,
        });
        prevAnchor = endWorld;
      } else if (s.type === 'Q') {
        const endWorld = this.transform.transformPoint({ x: s.x, y: s.y });
        const cWorld = this.transform.transformPoint({ x: s.cx, y: s.cy });
        if (prevAnchor) {
          result.push({
            x: cWorld.x,
            y: cWorld.y,
            type: 'control',
            cmdIdx: ci,
            ptIdx: 0,
            parentAnchor: { x: prevAnchor.x, y: prevAnchor.y },
          });
        }
        result.push({
          x: endWorld.x,
          y: endWorld.y,
          type: 'anchor',
          cmdIdx: ci,
          ptIdx: 2,
        });
        prevAnchor = endWorld;
      }
    }
    return result;
  }

  public toEditModel(): EditNodeModel {
    const cmds = segmentsToCommands(this.geometry.segments);
    const contours = commandsToContours(cmds);
    const m = this.transform.matrix;
    mapContours(contours, (p) => {
      const tp = m.transformPoint(new DOMPoint(p.x, p.y));
      return { x: tp.x, y: tp.y };
    });
    return { elementId: this.id, elementType: this.type, contours };
  }

  public applyEditModel(model: EditNodeModel): void {
    const inv = this.transform.matrix.inverse();
    const contours = model.contours.map((c) => ({
      closed: c.closed,
      nodes: c.nodes.map((n) => ({ ...n })),
    }));
    mapContours(contours, (p) => {
      const tp = inv.transformPoint(new DOMPoint(p.x, p.y));
      return { x: tp.x, y: tp.y };
    });
    const cmds = contoursToCommands(contours);
    this.geometry.segments = commandsToSegments(cmds);
    this.rebuildHitArea();
  }

  public toOutlinePath(): PathElement {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { svgStringToOutlinePath } = require('./svg-outline');
    const d = this.toDString();
    const fill = this.style.hasFill
      ? `fill="${this.style.fill}"`
      : 'fill="none"';
    const svgStr = `<path d="${d}" ${fill} stroke="${this.style.stroke}" stroke-width="${this.style.strokeWidth}"/>`;
    return svgStringToOutlinePath(svgStr, `${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    const cmds = segmentsToCommands(this.geometry.segments);
    const subPaths: PathCommand[][] = [];
    let cur: PathCommand[] = [];
    for (const cmd of cmds) {
      if (cmd.command === 'M' && cur.length > 0) {
        subPaths.push(cur);
        cur = [];
      }
      cur.push(cmd);
    }
    if (cur.length > 0) subPaths.push(cur);
    const result: Point[][] = [];
    for (const sp of subPaths) {
      const pts = flattenCommands(sp);
      if (pts.length >= 2) result.push(pts);
    }
    return result;
  }
}
