import type {
  PathCommand,
  Point,
  EditContour,
  EditNode,
  NodeKind,
} from '@/types';

let _nodeIdSeq = 0;
export function nextNodeId(): string {
  _nodeIdSeq += 1;
  return `n${_nodeIdSeq}`;
}

const EPS = 1e-6;

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
function len(p: Point): number {
  return Math.hypot(p.x, p.y);
}

/** Классификация узла по геометрии ручек. */
export function classifyNode(node: EditNode): NodeKind {
  if (!node.handleIn || !node.handleOut) return 'corner';
  const dIn = sub(node.handleIn, node.anchor);
  const dOut = sub(node.handleOut, node.anchor);
  const lIn = len(dIn);
  const lOut = len(dOut);
  if (lIn < EPS || lOut < EPS) return 'corner';
  const cross = dIn.x * dOut.y - dIn.y * dOut.x;
  const dot = dIn.x * dOut.x + dIn.y * dOut.y;
  const collinearOpposite = Math.abs(cross) < 1e-3 * lIn * lOut && dot < 0;
  if (!collinearOpposite) return 'corner';
  if (Math.abs(lIn - lOut) < 0.5) return 'symmetric';
  return 'smooth';
}

/** Q -> C: контрольные точки кубика из квадратичного. */
function quadToCubic(
  p0: Point,
  cq: Point,
  p3: Point,
): { c1: Point; c2: Point } {
  return {
    c1: {
      x: p0.x + (2 / 3) * (cq.x - p0.x),
      y: p0.y + (2 / 3) * (cq.y - p0.y),
    },
    c2: {
      x: p3.x + (2 / 3) * (cq.x - p3.x),
      y: p3.y + (2 / 3) * (cq.y - p3.y),
    },
  };
}

/**
 * Команды (абсолютные, локальные координаты) -> контуры.
 * Q/S/T нормализуются в кубические/линейные представления.
 */
export function commandsToContours(cmds: PathCommand[]): EditContour[] {
  const contours: EditContour[] = [];
  let cur: EditContour | null = null;
  let prevCtrl2: Point | null = null; // для S/T reflection

  const last = (): EditNode | null =>
    cur && cur.nodes.length > 0 ? cur.nodes[cur.nodes.length - 1] : null;

  for (const cmd of cmds) {
    const c = cmd.command.toUpperCase();
    const a = cmd.args;
    if (c === 'M') {
      if (cur) contours.push(cur);
      cur = { nodes: [], closed: false };
      prevCtrl2 = null;
      cur.nodes.push({
        id: nextNodeId(),
        anchor: { x: a[0], y: a[1] },
        type: 'corner',
      });
    } else if (c === 'L' || c === 'H' || c === 'V') {
      const prev = last();
      if (!cur || !prev) continue;
      const anchor =
        c === 'H'
          ? { x: a[0], y: prev.anchor.y }
          : c === 'V'
            ? { x: prev.anchor.x, y: a[0] }
            : { x: a[0], y: a[1] };
      cur.nodes.push({ id: nextNodeId(), anchor, type: 'corner' });
      prevCtrl2 = null;
    } else if (c === 'C' && a.length >= 6) {
      const prev = last();
      if (!cur || !prev) continue;
      prev.handleOut = { x: a[0], y: a[1] };
      const end = { x: a[4], y: a[5] };
      cur.nodes.push({
        id: nextNodeId(),
        anchor: end,
        handleIn: { x: a[2], y: a[3] },
        type: 'corner',
      });
      prevCtrl2 = { x: a[2], y: a[3] };
    } else if (c === 'S' && a.length >= 4) {
      const prev = last();
      if (!cur || !prev) continue;
      const reflected = prevCtrl2
        ? {
            x: 2 * prev.anchor.x - prevCtrl2.x,
            y: 2 * prev.anchor.y - prevCtrl2.y,
          }
        : { ...prev.anchor };
      prev.handleOut = reflected;
      const end = { x: a[2], y: a[3] };
      cur.nodes.push({
        id: nextNodeId(),
        anchor: end,
        handleIn: { x: a[0], y: a[1] },
        type: 'corner',
      });
      prevCtrl2 = { x: a[0], y: a[1] };
    } else if (c === 'Q' && a.length >= 4) {
      const prev = last();
      if (!cur || !prev) continue;
      const p0 = prev.anchor;
      const cq = { x: a[0], y: a[1] };
      const end = { x: a[2], y: a[3] };
      const { c1, c2 } = quadToCubic(p0, cq, end);
      prev.handleOut = c1;
      cur.nodes.push({
        id: nextNodeId(),
        anchor: end,
        handleIn: c2,
        type: 'corner',
      });
      prevCtrl2 = cq;
    } else if (c === 'T' && a.length >= 2) {
      const prev = last();
      if (!cur || !prev) continue;
      const p0 = prev.anchor;
      const cq: Point = prevCtrl2
        ? { x: 2 * p0.x - prevCtrl2.x, y: 2 * p0.y - prevCtrl2.y }
        : { x: p0.x, y: p0.y };
      const end = { x: a[0], y: a[1] };
      const { c1, c2 } = quadToCubic(p0, cq, end);
      prev.handleOut = c1;
      cur.nodes.push({
        id: nextNodeId(),
        anchor: end,
        handleIn: c2,
        type: 'corner',
      });
      prevCtrl2 = cq;
    } else if (c === 'Z') {
      if (cur) {
        cur.closed = true;
        const n = cur.nodes;
        if (n.length > 1) {
          const first = n[0];
          const lastN = n[n.length - 1];
          if (
            Math.abs(first.anchor.x - lastN.anchor.x) < 1e-4 &&
            Math.abs(first.anchor.y - lastN.anchor.y) < 1e-4
          ) {
            if (lastN.handleIn) first.handleIn = lastN.handleIn;
            n.pop();
          }
        }
        contours.push(cur);
        cur = null;
        prevCtrl2 = null;
      }
    }
  }
  if (cur) contours.push(cur);

  for (const contour of contours) {
    for (const node of contour.nodes) node.type = classifyNode(node);
  }
  return contours;
}

/** Контуры -> команды (локальные координаты, только M/L/C/Z). */
export function contoursToCommands(contours: EditContour[]): PathCommand[] {
  const cmds: PathCommand[] = [];
  for (const contour of contours) {
    const nodes = contour.nodes;
    if (nodes.length === 0) continue;
    cmds.push({ command: 'M', args: [nodes[0].anchor.x, nodes[0].anchor.y] });

    const seg = (from: EditNode, to: EditNode): void => {
      if (from.handleOut || to.handleIn) {
        const c1 = from.handleOut ?? from.anchor;
        const c2 = to.handleIn ?? to.anchor;
        cmds.push({
          command: 'C',
          args: [c1.x, c1.y, c2.x, c2.y, to.anchor.x, to.anchor.y],
        });
      } else {
        cmds.push({ command: 'L', args: [to.anchor.x, to.anchor.y] });
      }
    };

    for (let i = 1; i < nodes.length; i++) seg(nodes[i - 1], nodes[i]);
    if (contour.closed && nodes.length > 1) {
      seg(nodes[nodes.length - 1], nodes[0]);
      cmds.push({ command: 'Z', args: [] });
    }
  }
  return cmds;
}

/** Есть ли в модели кривизна (нужен ли path). */
export function contoursHaveCurves(contours: EditContour[]): boolean {
  for (const c of contours) {
    for (const n of c.nodes) {
      if (n.handleIn || n.handleOut) return true;
    }
  }
  return false;
}

/** Контуры -> строка points (для polyline/polygon; ручки игнорируются). */
export function contoursToPointsString(contours: EditContour[]): string {
  const parts: string[] = [];
  for (const c of contours) {
    for (const n of c.nodes) parts.push(`${n.anchor.x},${n.anchor.y}`);
  }
  return parts.join(' ');
}

/** Применить преобразование координат ко всем точкам контуров (in place). */
export function mapContours(
  contours: EditContour[],
  fn: (p: Point) => Point,
): void {
  for (const c of contours) {
    for (const n of c.nodes) {
      n.anchor = fn(n.anchor);
      if (n.handleIn) n.handleIn = fn(n.handleIn);
      if (n.handleOut) n.handleOut = fn(n.handleOut);
    }
  }
}
