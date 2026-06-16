import type { Point, PathCommand } from '@/types';

const flattenCubic = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  steps = 12,
): Point[] => {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x:
        mt * mt * mt * x0 +
        3 * mt * mt * t * x1 +
        3 * mt * t * t * x2 +
        t * t * t * x3,
      y:
        mt * mt * mt * y0 +
        3 * mt * mt * t * y1 +
        3 * mt * t * t * y2 +
        t * t * t * y3,
    });
  }
  return pts;
};

const flattenQuadratic = (
  x0: number,
  y0: number,
  x1: number | undefined,
  y1: number | undefined,
  x2: number,
  y2: number,
  steps = 10,
): Point[] => {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * x0 + 2 * mt * t * (x1 ?? (x0 + x2) / 2) + t * t * x2,
      y: mt * mt * y0 + 2 * mt * t * (y1 ?? (y0 + y2) / 2) + t * t * y2,
    });
  }
  return pts;
};

const flattenArc = (
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  xAxisRot: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
  steps = 12,
): Point[] => {
  const pts: Point[] = [];
  const angle = (xAxisRot * Math.PI) / 180;
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle);
  const dx = (x0 - x2) / 2,
    dy = (y0 - y2) / 2;
  const x1p = cosA * dx + sinA * dy,
    y1p = -sinA * dx + cosA * dy;
  let rX = Math.abs(rx),
    rY = Math.abs(ry);
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
  const cxp = (coef * rX * y1p) / rY,
    cyp = (coef * -rY * x1p) / rX;
  const cx = cosA * cxp - sinA * cyp + (x0 + x2) / 2,
    cy = sinA * cxp + cosA * cyp + (y0 + y2) / 2;
  const startAngle = Math.atan2((y1p - cyp) / rY, (x1p - cxp) / rX);
  const endAngle = Math.atan2((-y1p - cyp) / rY, (-x1p - cxp) / rX);
  let deltaA = endAngle - startAngle;
  if (sweep === 0 && deltaA > 0) deltaA -= 2 * Math.PI;
  if (sweep === 1 && deltaA < 0) deltaA += 2 * Math.PI;
  for (let i = 1; i <= steps; i++) {
    const a = startAngle + (deltaA * i) / steps;
    pts.push({
      x: cx + rX * Math.cos(a) * cosA - rY * Math.sin(a) * sinA,
      y: cy + rX * Math.cos(a) * sinA + rY * Math.sin(a) * cosA,
    });
  }
  return pts;
};

export const parseD = (d: string): PathCommand[] => {
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
  return commands;
};

export const commandsToString = (commands: PathCommand[]): string =>
  commands.map((cmd) => `${cmd.command}${cmd.args.join(' ')}`).join(' ');

export const flattenCommands = (commands: PathCommand[], steps?: number): Point[] => {
  const points: Point[] = [];
  let currentX = 0,
    currentY = 0,
    startX = 0,
    startY = 0;
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
      for (const p of flattenCubic(
        currentX, currentY,
        a[0], a[1], a[2], a[3], a[4], a[5],
        steps,
      ))
        points.push(p);
      currentX = a[4];
      currentY = a[5];
    } else if (c === 'S') {
      const prev = commands[i > 0 ? i - 1 : 0];
      let rx = currentX,
        ry = currentY;
      if (prev.command === 'C' || prev.command === 'S') {
        const pa = prev.args;
        const lx = prev.command === 'C' ? pa[2] : pa[0];
        const ly = prev.command === 'C' ? pa[3] : pa[1];
        rx = 2 * currentX - lx;
        ry = 2 * currentY - ly;
      }
      for (const p of flattenCubic(
        currentX, currentY,
        rx, ry,
        a[0], a[1], a[2], a[3],
        steps,
      ))
        points.push(p);
      currentX = a[2];
      currentY = a[3];
    } else if (c === 'Q' || c === 'T') {
      for (const p of flattenQuadratic(
        currentX, currentY,
        c === 'Q' ? a[0] : undefined,
        c === 'Q' ? a[1] : undefined,
        a[c === 'Q' ? 2 : 0],
        a[c === 'Q' ? 3 : 1],
        steps,
      ))
        points.push(p);
      currentX = c === 'Q' ? a[2] : a[0];
      currentY = c === 'Q' ? a[3] : a[1];
    } else if (c === 'A') {
      for (const p of flattenArc(
        currentX, currentY,
        a[0], a[1], a[2], a[3], a[4], a[5], a[6],
        steps,
      ))
        points.push(p);
      currentX = a[5];
      currentY = a[6];
    } else if (c === 'Z') {
      points.push({ x: startX, y: startY });
      currentX = startX;
      currentY = startY;
    }
  }
  return points;
};

export const transformCommands = (
  commands: PathCommand[],
  m: DOMMatrix,
): PathCommand[] =>
  commands.map((cmd) => {
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
    return cmd;
  });

export const applyMatrixToPoint = (
  m: DOMMatrix,
  x: number,
  y: number,
): Point => {
  const pt = new DOMPoint(x, y).matrixTransform(m);
  return { x: pt.x, y: pt.y };
};
