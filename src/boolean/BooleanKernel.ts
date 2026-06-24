import * as ClipperLib from 'clipper-lib';

type BooleanOp = 'UNION' | 'INTERSECT' | 'DIFFERENCE';
type Pt = { x: number; y: number };

export type { BooleanOp, Pt };

const SCALE = 1e6;

function toClipper(polygons: Pt[][]): ClipperLib.Path[] {
  return polygons.map((ring) =>
    ring.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })),
  );
}

function fromClipper(paths: ClipperLib.Path[]): Pt[][] {
  return paths.map((path) =>
    path.map((p: ClipperLib.IntPoint) => ({ x: p.X / SCALE, y: p.Y / SCALE })),
  );
}

const CLIP_TYPE: Record<BooleanOp, number> = {
  UNION: ClipperLib.ClipType.ctUnion,
  INTERSECT: ClipperLib.ClipType.ctIntersection,
  DIFFERENCE: ClipperLib.ClipType.ctDifference,
};

export function booleanOperation(
  subjectRings: Pt[][],
  clipRings: Pt[][],
  op: BooleanOp,
): Pt[][] {
  if (subjectRings.length === 0 || clipRings.length === 0) {
    if (op === 'UNION') return [...subjectRings, ...clipRings];
    if (op === 'INTERSECT') return [];
    if (op === 'DIFFERENCE') return subjectRings.slice();
  }

  const subj = toClipper(subjectRings);
  const clip = toClipper(clipRings);

  const cpr = new ClipperLib.Clipper();
  cpr.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  cpr.AddPaths(clip, ClipperLib.PolyType.ptClip, true);

  const solution = new ClipperLib.Paths();
  const ok = cpr.Execute(CLIP_TYPE[op], solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

  if (!ok || solution.length === 0) {
    if (op === 'UNION') return [...subjectRings, ...clipRings];
    if (op === 'INTERSECT') return [];
    if (op === 'DIFFERENCE') return subjectRings.slice();
  }

  return fromClipper(solution);
}
