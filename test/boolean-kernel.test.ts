import { booleanOperation } from '../src/boolean/BooleanKernel';
import type { BooleanOp, Pt } from '../src/boolean/BooleanKernel';

function applyMatrix(pts: Pt[], dx: number, dy: number): Pt[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

function bbox(pts: Pt[]) {
  let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
  for (const p of pts) {
    if (p.x < mx) mx = p.x; if (p.y < my) my = p.y;
    if (p.x > Mx) Mx = p.x; if (p.y > My) My = p.y;
  }
  return { x: mx, y: my, w: Mx - mx, h: My - my };
}

function shortBB(b: ReturnType<typeof bbox>) {
  return `${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.w.toFixed(0)}x${b.h.toFixed(0)}`;
}

const circle: Pt[] = [
  {x:370,y:90},{x:368.3,y:102.9},{x:363.3,y:115},{x:355.4,y:125.4},
  {x:345,y:133.3},{x:332.9,y:138.3},{x:320,y:140},{x:307.1,y:138.3},
  {x:295,y:133.3},{x:284.6,y:125.4},{x:276.7,y:115},{x:271.7,y:102.9},
  {x:270,y:90},{x:271.7,y:77.1},{x:276.7,y:65},{x:284.6,y:54.6},
  {x:295,y:46.7},{x:307.1,y:41.7},{x:320,y:40},{x:332.9,y:41.7},
  {x:345,y:46.7},{x:355.4,y:54.6},{x:363.3,y:65},{x:368.3,y:77.1},
];

const ellipse: Pt[] = [
  {x:550,y:90},{x:547.6,y:100.4},{x:540.6,y:110},{x:529.5,y:118.3},
  {x:515,y:124.6},{x:498.1,y:128.6},{x:480,y:130},{x:461.9,y:128.6},
  {x:445,y:124.6},{x:430.5,y:118.3},{x:419.4,y:110},{x:412.4,y:100.4},
  {x:410,y:90},{x:412.4,y:79.6},{x:419.4,y:70},{x:430.5,y:61.7},
  {x:445,y:55.4},{x:461.9,y:51.4},{x:480,y:50},{x:498.1,y:51.4},
  {x:515,y:55.4},{x:529.5,y:61.7},{x:540.6,y:70},{x:547.6,y:79.6},
];

const dx = 120, dy = 0;
const cw = applyMatrix(circle, dx, dy);

console.log('Circle:', shortBB(bbox(cw)), 'Ellipse:', shortBB(bbox(ellipse)));
console.log();

const ops: BooleanOp[] = ['UNION', 'INTERSECT', 'DIFFERENCE'];
for (const op of ops) {
  const res = booleanOperation([cw], [ellipse], op);
  const info = res.map((r) => `${r.length}pts ${shortBB(bbox(r))}`).join(' | ');
  console.log(`${op.padEnd(12)}: ${res.length} ring(s)  ${info || '(empty)'}`);
}
