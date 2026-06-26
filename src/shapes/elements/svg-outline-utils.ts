import { PathElement } from './PathElement';
import { parseD } from '@/spatial/path-utils';

type OutlineFn = (svgData: string, distance: number, opts?: Record<string, unknown>) => string;

let _outlineFn: OutlineFn | null = null;

function getOutlineFn(): OutlineFn {
  if (_outlineFn) return _outlineFn;
  try {
    _outlineFn = require('svg-path-outline') as OutlineFn;
  } catch {
    _outlineFn = (() => '') as unknown as OutlineFn;
  }
  return _outlineFn;
}

export function svgStringToOutlinePath(svgString: string, id: string): PathElement {
  const outline = getOutlineFn();
  const d = outline(svgString, 0, { tagName: 'path' });
  const path = new PathElement(id);
  if (d) {
    path.geometry.commands = parseD(d);
  }
  path.buildHitArea();
  return path;
}
