// ---- legacy flat model (used by math/utils) ----

export interface PathCommand {
  command: string;
  args: number[];
}

export type InteractivePathCommand = 'M' | 'L' | 'C' | 'Q' | 'Z';

// ---- typed segment model (used by PathElement) ----

export type PathSegment =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | {
      type: 'C';
      c1x: number;
      c1y: number;
      c2x: number;
      c2y: number;
      x: number;
      y: number;
    }
  | {
      type: 'Q';
      cx: number;
      cy: number;
      x: number;
      y: number;
    }
  | { type: 'Z' };

export function segmentsToCommands(segments: PathSegment[]): PathCommand[] {
  const cmds: PathCommand[] = [];
  for (const s of segments) {
    switch (s.type) {
      case 'M':
      case 'L':
        cmds.push({ command: s.type, args: [s.x, s.y] });
        break;
      case 'C':
        cmds.push({
          command: 'C',
          args: [s.c1x, s.c1y, s.c2x, s.c2y, s.x, s.y],
        });
        break;
      case 'Q':
        cmds.push({ command: 'Q', args: [s.cx, s.cy, s.x, s.y] });
        break;
      case 'Z':
        cmds.push({ command: 'Z', args: [] });
        break;
    }
  }
  return cmds;
}

export function commandsToSegments(cmds: PathCommand[]): PathSegment[] {
  const result: PathSegment[] = [];
  for (const c of cmds) {
    const uc = c.command.toUpperCase();
    switch (uc) {
      case 'M':
        result.push({ type: 'M', x: c.args[0], y: c.args[1] });
        break;
      case 'L':
        result.push({ type: 'L', x: c.args[0], y: c.args[1] });
        break;
      case 'C':
        result.push({
          type: 'C',
          c1x: c.args[0],
          c1y: c.args[1],
          c2x: c.args[2],
          c2y: c.args[3],
          x: c.args[4],
          y: c.args[5],
        });
        break;
      case 'Q':
        result.push({
          type: 'Q',
          cx: c.args[0],
          cy: c.args[1],
          x: c.args[2],
          y: c.args[3],
        });
        break;
      case 'Z':
        result.push({ type: 'Z' });
        break;
    }
  }
  return result;
}

export function segmentsToD(segments: PathSegment[]): string {
  return segments
    .map((s) => {
      switch (s.type) {
        case 'M':
        case 'L':
          return `${s.type}${s.x} ${s.y}`;
        case 'C':
          return `C${s.c1x} ${s.c1y} ${s.c2x} ${s.c2y} ${s.x} ${s.y}`;
        case 'Q':
          return `Q${s.cx} ${s.cy} ${s.x} ${s.y}`;
        case 'Z':
          return 'Z';
      }
    })
    .join(' ');
}
