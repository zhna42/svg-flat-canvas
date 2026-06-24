type BooleanOp = 'UNION' | 'INTERSECT' | 'DIFFERENCE';
type Pt = { x: number; y: number };

export type { BooleanOp, Pt };

const EPS = 1e-10;
const JITTER = 1e-5;

function jitterPoint(p: Pt, seed: number): Pt {
  const sx = ((seed * 0.123871 + p.x * 0.567321 + p.y * 0.891234) % 1) * 2 - 1;
  const sy = ((seed * 0.987654 + p.x * 0.432109 + p.y * 0.678901) % 1) * 2 - 1;
  return { x: p.x + sx * JITTER, y: p.y + sy * JITTER };
}

function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const j = (i + 1) % poly.length; a += poly[i].x * poly[j].y - poly[j].x * poly[i].y; }
  return a / 2;
}

function isClockwise(poly: Pt[]): boolean { return polygonArea(poly) < 0; }

function ensureCCW(poly: Pt[]): Pt[] { return isClockwise(poly) ? poly.slice().reverse() : poly; }

function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < ((poly[j].x - poly[i].x) * (pt.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
  }
  return inside;
}

function insideEdge(pt: Pt, a: Pt, b: Pt): boolean {
  return (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x) >= -EPS;
}

function lineIntersection(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y, dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPS) return null;
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  return { x: a1.x + t * dx1, y: a1.y + t * dy1 };
}

function segIntersection(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y, dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPS) return null;
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: a1.x + t * dx1, y: a1.y + t * dy1 };
}

function sutherlandHodgman(subject: Pt[], clip: Pt[]): Pt[] {
  let output = subject.slice();
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      const pIn = insideEdge(p, a, b), qIn = insideEdge(q, a, b);
      if (pIn && qIn) { output.push(q); }
      else if (pIn && !qIn) { const ix = lineIntersection(p, q, a, b); if (ix) output.push(ix); }
      else if (!pIn && qIn) { const ix = lineIntersection(p, q, a, b); if (ix) { output.push(ix); output.push(q); } }
    }
  }
  return output;
}

function findIntersections(subj: Pt[], clip: Pt[]): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < subj.length; i++) { const a1 = subj[i], a2 = subj[(i+1)%subj.length];
    for (let j = 0; j < clip.length; j++) { const b1 = clip[j], b2 = clip[(j+1)%clip.length];
      const ix = segIntersection(a1, a2, b1, b2);
      if (ix) pts.push(ix);
    }
  }
  return pts;
}

function sortAroundCenter(pts: Pt[]): Pt[] {
  if (pts.length === 0) return pts;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function convexUnion(subject: Pt[], clip: Pt[]): Pt[] {
  const ix = findIntersections(subject, clip);
  if (ix.length < 2) return [];

  const result: Pt[] = [];

  for (const pt of subject) { if (!pointInPolygon(pt, clip)) result.push(pt); }
  for (const pt of clip) { if (!pointInPolygon(pt, subject)) result.push(pt); }
  for (const pt of ix) { result.push(pt); }

  const deduped: Pt[] = [];
  for (const pt of result) {
    if (!deduped.some((r) => Math.abs(r.x - pt.x) < 0.01 && Math.abs(r.y - pt.y) < 0.01)) deduped.push(pt);
  }

  if (deduped.length < 3) return [];
  return sortAroundCenter(deduped);
}

function convexDiff(subject: Pt[], clip: Pt[]): Pt[] {
  const ix = findIntersections(subject, clip);
  if (ix.length < 2) return subject.filter((p) => !pointInPolygon(p, clip));

  const result: Pt[] = [];

  for (const pt of subject) { if (!pointInPolygon(pt, clip)) result.push(pt); }
  for (const pt of ix) { result.push(pt); }

  const deduped: Pt[] = [];
  for (const pt of result) {
    if (!deduped.some((r) => Math.abs(r.x - pt.x) < 0.01 && Math.abs(r.y - pt.y) < 0.01)) deduped.push(pt);
  }

  if (deduped.length < 3) return [];
  return sortAroundCenter(deduped);
}

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

  const subject = ensureCCW(subjectRings[0].map((p) => jitterPoint(p, 42)));
  const clip = ensureCCW(clipRings[0]);

  const hasOverlap = subject.some((p) => pointInPolygon(p, clip)) || clip.some((p) => pointInPolygon(p, subject));
  const ix = findIntersections(subject, clip);

  if (!hasOverlap && ix.length === 0) {
    if (op === 'UNION') return [subject, clip];
    if (op === 'INTERSECT') return [];
    if (op === 'DIFFERENCE') return [subject];
  }

  const subInsideClip = subject.every((p) => pointInPolygon(p, clip));
  const clipInsideSub = clip.every((p) => pointInPolygon(p, subject));

  if (subInsideClip || clipInsideSub) {
    if (op === 'UNION') return subInsideClip ? [clip] : [subject];
    if (op === 'INTERSECT') return subInsideClip ? [subject] : [clip];
    if (op === 'DIFFERENCE') return subInsideClip ? [] : [subject];
  }

  if (op === 'UNION') {
    const u = convexUnion(subject, clip);
    return u.length > 0 ? [u] : [];
  }
  if (op === 'INTERSECT') {
    const i = sutherlandHodgman(subject, clip);
    return i.length > 0 ? [i] : [];
  }
  const d = convexDiff(subject, clip);
  return d.length > 0 ? [d] : [];
}
