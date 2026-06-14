export interface Point {
  x: number;
  y: number;
}

export type TransformOp =
  | { type: 'translate'; dx: number; dy: number }
  | { type: 'resize'; handle: string; dx: number; dy: number; ox: number; oy: number; ow: number; oh: number; otx: number; oty: number; osx: number; osy: number }
  | { type: 'rotate'; angle: number; cx: number; cy: number };

