import { SvgElement } from './SvgElement';
import type { Point, PathCommand } from '@/types';
import { MIN_HIT_STROKE_WIDTH } from '@/constants';

interface ParsedPath {
  commands: PathCommand[];
}

export class PathElement extends SvgElement {
  private _parsedPath: ParsedPath | null = null;
  private _dirtyPath = true;

  public constructor(id: string) {
    super(id, 'path', 'path');
  }

  public get parsedD(): ParsedPath {
    if (this._parsedPath === null || this._dirtyPath) {
      this._parsedPath = this.parseD(this.element.getAttribute('d') || '');
      this._dirtyPath = false;
    }
    return this._parsedPath;
  }

  public get segments(): string[] {
    const d = this.element.getAttribute('d') || '';
    if (!d) return [];
    return d
      .split(/(?=M)/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  public get segmentsParsed(): PathCommand[][] {
    return this.segments.map((seg) => this.parseD(seg).commands);
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

    const newCommands = this.parsedD.commands.map((cmd) => {
      if (cmd.command === 'M' || cmd.command === 'L') {
        const pt = this.applyMatrix(ctm, cmd.args[0], cmd.args[1]);
        return { command: cmd.command, args: [pt.x, pt.y] };
      }
      if (cmd.command === 'H') {
        const pt = this.applyMatrix(ctm, cmd.args[0], 0);
        return { command: 'L', args: [pt.x, pt.y] };
      }
      if (cmd.command === 'V') {
        const pt = this.applyMatrix(ctm, 0, cmd.args[0]);
        return { command: 'L', args: [pt.x, pt.y] };
      }
      if (cmd.command === 'C') {
        const p1 = this.applyMatrix(ctm, cmd.args[0], cmd.args[1]);
        const p2 = this.applyMatrix(ctm, cmd.args[2], cmd.args[3]);
        const p3 = this.applyMatrix(ctm, cmd.args[4], cmd.args[5]);
        return {
          command: 'C',
          args: [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y],
        };
      }
      if (cmd.command === 'S') {
        const p1 = this.applyMatrix(ctm, cmd.args[0], cmd.args[1]);
        const p2 = this.applyMatrix(ctm, cmd.args[2], cmd.args[3]);
        return { command: 'S', args: [p1.x, p1.y, p2.x, p2.y] };
      }
      if (cmd.command === 'Q') {
        const p1 = this.applyMatrix(ctm, cmd.args[0], cmd.args[1]);
        const p2 = this.applyMatrix(ctm, cmd.args[2], cmd.args[3]);
        return { command: 'Q', args: [p1.x, p1.y, p2.x, p2.y] };
      }
      if (cmd.command === 'T') {
        const pt = this.applyMatrix(ctm, cmd.args[0], cmd.args[1]);
        return { command: 'T', args: [pt.x, pt.y] };
      }
      if (cmd.command === 'A') {
        const pt = this.applyMatrix(ctm, cmd.args[5], cmd.args[6]);
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
      if (cmd.command === 'Z' || cmd.command === 'z') {
        return cmd;
      }
      return cmd;
    });

    const newD = this.commandsToString(newCommands);
    this.element.setAttribute('d', newD);
    this.element.removeAttribute('transform');
    this._parsedPath = null;
    this._dirtyPath = true;
    this.setDirty();
  }

  public buildHitArea(): void {
    const cmds = this.parsedD.commands;
    if (cmds.length === 0) return;

    const flat = this.flattenCommands(cmds);
    const sw = this.hasFill()
      ? 0
      : Math.max(this.getStrokeWidth(), MIN_HIT_STROKE_WIDTH);
    const offset = sw / 2;

    if (offset === 0) {
      this._hitArea = flat;
      return;
    }

    const isClosed = cmds.length > 0 && (cmds[cmds.length - 1].command === 'Z' || cmds[cmds.length - 1].command === 'z');

    if (isClosed) {
      this._hitArea = this.offsetPolygon(flat, offset);
    } else {
      this._hitArea = this.offsetOpenPath(flat, offset);
    }
  }

  private offsetOpenPath(poly: Point[], offset: number): Point[] {
    if (poly.length < 2) return poly;

    const left: Point[] = [];
    const right: Point[] = [];

    const dir = (ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return { dx: 0, dy: 0 };
      return { dx: dx / len, dy: dy / len };
    };

    const perp = (ax: number, ay: number, bx: number, by: number) => {
      const d = dir(ax, ay, bx, by);
      return { nx: -d.dy * offset, ny: d.dx * offset };
    };

    const miter = (p: Point, pnx: number, pny: number, nnx: number, nny: number) => {
      const mx = (pnx + nnx) / 2;
      const my = (pny + nny) / 2;
      const len = Math.sqrt(mx * mx + my * my);
      if (len === 0) return { x: p.x + pnx, y: p.y + pny };
      const scale = offset / len;
      return { x: p.x + mx * scale, y: p.y + my * scale };
    };

    // start butt cap
    const startDir = dir(poly[0].x, poly[0].y, poly[1].x, poly[1].y);
    const startN = { nx: -startDir.dy * offset, ny: startDir.dx * offset };
    left.push(
      { x: poly[0].x + startN.nx - startDir.dx * offset, y: poly[0].y + startN.ny - startDir.dy * offset },
    );
    left.push({ x: poly[0].x + startN.nx, y: poly[0].y + startN.ny });

    for (let i = 1; i < poly.length - 1; i++) {
      const pn = perp(poly[i - 1].x, poly[i - 1].y, poly[i].x, poly[i].y);
      const nn = perp(poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y);
      left.push(miter(poly[i], pn.nx, pn.ny, nn.nx, nn.ny));
    }

    const endDir = dir(poly[poly.length - 2].x, poly[poly.length - 2].y, poly[poly.length - 1].x, poly[poly.length - 1].y);
    const endN = { nx: -endDir.dy * offset, ny: endDir.dx * offset };
    left.push({ x: poly[poly.length - 1].x + endN.nx, y: poly[poly.length - 1].y + endN.ny });

    // end butt cap
    right.push({ x: poly[poly.length - 1].x + endDir.dx * offset - endN.nx, y: poly[poly.length - 1].y + endDir.dy * offset - endN.ny });

    right.push({ x: poly[poly.length - 1].x - endN.nx, y: poly[poly.length - 1].y - endN.ny });

    for (let i = poly.length - 2; i >= 1; i--) {
      const pn = perp(poly[i - 1].x, poly[i - 1].y, poly[i].x, poly[i].y);
      const nn = perp(poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y);
      right.push(miter(poly[i], -pn.nx, -pn.ny, -nn.nx, -nn.ny));
    }

    right.push({ x: poly[0].x - startN.nx, y: poly[0].y - startN.ny });
    right.push({ x: poly[0].x - startDir.dx * offset - startN.nx, y: poly[0].y - startDir.dy * offset - startN.ny });

    return [...left, ...right];
  }

  public clone(): PathElement {
    const el = new PathElement(this.id);
    const d = this.element.getAttribute('d');
    if (d !== null) el.element.setAttribute('d', d);
    ['fill', 'stroke', 'stroke-width', 'opacity', 'transform'].forEach(
      (attr) => {
        const v = this.element.getAttribute(attr);
        if (v !== null) el.element.setAttribute(attr, v);
      },
    );
    return el;
  }

  protected createClone(): PathElement {
    return new PathElement(this.id);
  }

  public applyMatrixToD(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const m = new DOMMatrix([a, b, c, d, e, f]);
    const cmds = this.parsedD.commands.map((cmd) => {
      if (cmd.command === 'M' || cmd.command === 'L') {
        const pt = m.transformPoint({ x: cmd.args[0], y: cmd.args[1] });
        return { command: cmd.command, args: [pt.x, pt.y] };
      }
      if (cmd.command === 'H') {
        const pt = m.transformPoint({ x: cmd.args[0], y: 0 });
        return { command: 'L', args: [pt.x, pt.y] };
      }
      if (cmd.command === 'V') {
        const pt = m.transformPoint({ x: 0, y: cmd.args[0] });
        return { command: 'L', args: [pt.x, pt.y] };
      }
      if (cmd.command === 'C') {
        const p1 = m.transformPoint({ x: cmd.args[0], y: cmd.args[1] });
        const p2 = m.transformPoint({ x: cmd.args[2], y: cmd.args[3] });
        const p3 = m.transformPoint({ x: cmd.args[4], y: cmd.args[5] });
        return { command: 'C', args: [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y] };
      }
      if (cmd.command === 'S') {
        const p1 = m.transformPoint({ x: cmd.args[0], y: cmd.args[1] });
        const p2 = m.transformPoint({ x: cmd.args[2], y: cmd.args[3] });
        return { command: 'S', args: [p1.x, p1.y, p2.x, p2.y] };
      }
      if (cmd.command === 'Q') {
        const p1 = m.transformPoint({ x: cmd.args[0], y: cmd.args[1] });
        const p2 = m.transformPoint({ x: cmd.args[2], y: cmd.args[3] });
        return { command: 'Q', args: [p1.x, p1.y, p2.x, p2.y] };
      }
      if (cmd.command === 'T') {
        const pt = m.transformPoint({ x: cmd.args[0], y: cmd.args[1] });
        return { command: 'T', args: [pt.x, pt.y] };
      }
      if (cmd.command === 'A') {
        const pt = m.transformPoint({ x: cmd.args[5], y: cmd.args[6] });
        return { command: 'A', args: [cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3], cmd.args[4], pt.x, pt.y] };
      }
      return cmd;
    });
    const newD = this.commandsToString(cmds);
    this.element.setAttribute('d', newD);
    this._parsedPath = null;
    this._dirtyPath = true;
    this.setDirty();
  }

  private parseD(d: string): ParsedPath {
    const commands: PathCommand[] = [];
    const regex = /([MLHVCSQTAZ])\s*([^MLHVCSQTAZ]*)/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(d)) !== null) {
      const command = match[1].toUpperCase();
      const argsStr = match[2].trim();
      const args = argsStr
        ? argsStr
            .split(/[\s,]+/)
            .map(Number)
            .filter((n) => !isNaN(n))
        : [];
      commands.push({ command, args });
    }

    return { commands };
  }

  private flattenCommands(commands: PathCommand[]): Point[] {
    const points: Point[] = [];
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const c = cmd.command;
      const a = cmd.args;

      if (c === 'M') {
        startX = a[0];
        startY = a[1];
        currentX = startX;
        currentY = startY;
        points.push({ x: currentX, y: currentY });
      } else if (c === 'L') {
        currentX = a[0];
        currentY = a[1];
        points.push({ x: currentX, y: currentY });
      } else if (c === 'H') {
        currentX = a[0];
        points.push({ x: currentX, y: currentY });
      } else if (c === 'V') {
        currentY = a[0];
        points.push({ x: currentX, y: currentY });
      } else if (c === 'C') {
        const pts = this.flattenCubic(
          currentX,
          currentY,
          a[0],
          a[1],
          a[2],
          a[3],
          a[4],
          a[5],
        );
        for (const p of pts) points.push(p);
        currentX = a[4];
        currentY = a[5];
      } else if (c === 'S') {
        const prevCmd = commands[i > 0 ? i - 1 : 0];
        let reflectX = currentX;
        let reflectY = currentY;
        if (prevCmd.command === 'C' || prevCmd.command === 'S') {
          const prevArgs = prevCmd.args;
          const lastCpX = prevCmd.command === 'C' ? prevArgs[2] : prevArgs[0];
          const lastCpY = prevCmd.command === 'C' ? prevArgs[3] : prevArgs[1];
          reflectX = 2 * currentX - lastCpX;
          reflectY = 2 * currentY - lastCpY;
        }
        const pts = this.flattenCubic(
          currentX,
          currentY,
          reflectX,
          reflectY,
          a[0],
          a[1],
          a[2],
          a[3],
        );
        for (const p of pts) points.push(p);
        currentX = a[2];
        currentY = a[3];
      } else if (c === 'Q' || c === 'T') {
        const pts = this.flattenQuadratic(
          currentX,
          currentY,
          c === 'Q' ? a[0] : undefined,
          c === 'Q' ? a[1] : undefined,
          a[c === 'Q' ? 2 : 0],
          a[c === 'Q' ? 3 : 1],
        );
        for (const p of pts) points.push(p);
        currentX = c === 'Q' ? a[2] : a[0];
        currentY = c === 'Q' ? a[3] : a[1];
      } else if (c === 'A') {
        const pts = this.flattenArc(
          currentX,
          currentY,
          a[0],
          a[1],
          a[2],
          a[3],
          a[4],
          a[5],
          a[6],
        );
        for (const p of pts) points.push(p);
        currentX = a[5];
        currentY = a[6];
      } else if (c === 'Z') {
        points.push({ x: startX, y: startY });
        currentX = startX;
        currentY = startY;
      }
    }

    return points;
  }

  private flattenCubic(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): Point[] {
    const pts: Point[] = [];
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x =
        mt * mt * mt * x0 +
        3 * mt * mt * t * x1 +
        3 * mt * t * t * x2 +
        t * t * t * x3;
      const y =
        mt * mt * mt * y0 +
        3 * mt * mt * t * y1 +
        3 * mt * t * t * y2 +
        t * t * t * y3;
      pts.push({ x, y });
    }
    return pts;
  }

  private flattenQuadratic(
    x0: number,
    y0: number,
    x1: number | undefined,
    y1: number | undefined,
    x2: number,
    y2: number,
  ): Point[] {
    const pts: Point[] = [];
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * x0 + 2 * mt * t * (x1 ?? (x0 + x2) / 2) + t * t * x2;
      const y = mt * mt * y0 + 2 * mt * t * (y1 ?? (y0 + y2) / 2) + t * t * y2;
      pts.push({ x, y });
    }
    return pts;
  }

  private flattenArc(
    x0: number,
    y0: number,
    rx: number,
    ry: number,
    xAxisRot: number,
    largeArc: number,
    sweep: number,
    x2: number,
    y2: number,
  ): Point[] {
    const pts: Point[] = [];
    const angle = (xAxisRot * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const dx = (x0 - x2) / 2;
    const dy = (y0 - y2) / 2;
    const x1p = cosA * dx + sinA * dy;
    const y1p = -sinA * dx + cosA * dy;

    let rX = Math.abs(rx);
    let rY = Math.abs(ry);
    const sq = (x1p * x1p) / (rX * rX) + (y1p * y1p) / (rY * rY);
    if (sq > 1) {
      rX *= Math.sqrt(sq);
      rY *= Math.sqrt(sq);
    }

    const sign = largeArc === sweep ? -1 : 1;
    const sq2 =
      (rX * rX * rY * rY - rX * rX * y1p * y1p - rY * rY * x1p * x1p) /
      (rX * rX * y1p * y1p + rY * rY * x1p * x1p);
    const coef = sign * Math.sqrt(Math.max(0, sq2));
    const cxp = (coef * rX * y1p) / rY;
    const cyp = (coef * -rY * x1p) / rX;

    const cx = cosA * cxp - sinA * cyp + (x0 + x2) / 2;
    const cy = sinA * cxp + cosA * cyp + (y0 + y2) / 2;

    const startAngle = Math.atan2((y1p - cyp) / rY, (x1p - cxp) / rX);
    const endAngle = Math.atan2((-y1p - cyp) / rY, (-x1p - cxp) / rX);

    let delta = endAngle - startAngle;
    if (sweep === 0 && delta > 0) delta -= 2 * Math.PI;
    if (sweep === 1 && delta < 0) delta += 2 * Math.PI;

    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const a = startAngle + (delta * i) / steps;
      const ex = cx + rX * Math.cos(a) * cosA - rY * Math.sin(a) * sinA;
      const ey = cy + rX * Math.cos(a) * sinA + rY * Math.sin(a) * cosA;
      pts.push({ x: ex, y: ey });
    }

    return pts;
  }

  private offsetPolygon(poly: Point[], offset: number): Point[] {
    if (poly.length < 3) return poly;

    const result: Point[] = [];
    const n = poly.length;

    for (let i = 0; i < n; i++) {
      const prev = poly[(i - 1 + n) % n];
      const curr = poly[i];
      const next = poly[(i + 1) % n];

      const e1x = curr.x - prev.x;
      const e1y = curr.y - prev.y;
      const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
      const n1x = len1 > 0 ? -e1y / len1 : 0;
      const n1y = len1 > 0 ? e1x / len1 : 0;

      const e2x = next.x - curr.x;
      const e2y = next.y - curr.y;
      const len2 = Math.sqrt(e2x * e2x + e2y * e2y);
      const n2x = len2 > 0 ? -e2y / len2 : 0;
      const n2y = len2 > 0 ? e2x / len2 : 0;

      const bisX = n1x + n2x;
      const bisY = n1y + n2y;
      const bisLen = Math.sqrt(bisX * bisX + bisY * bisY);
      const scale = bisLen > 0 ? offset / bisLen : offset;

      result.push({
        x: curr.x + bisX * scale,
        y: curr.y + bisY * scale,
      });
    }

    return result;
  }

  private applyMatrix(m: DOMMatrix, x: number, y: number): Point {
    const pt = new DOMPoint(x, y).matrixTransform(m);
    return { x: pt.x, y: pt.y };
  }

  private commandsToString(commands: PathCommand[]): string {
    return commands
      .map((cmd) => `${cmd.command}${cmd.args.join(' ')}`)
      .join(' ');
  }
}
