import type {
  ResizeCommand,
  RotateCommand,
  TransformCommand,
  BBox,
} from '../types';

export function createResizeCommand(
  elementIds: string[],
  bbox: BBox,
): ResizeCommand {
  return { type: 'RESIZE', options: { elementIds, bbox } };
}

export function createRotateCommand(
  elementIds: string[],
  angle: number,
): RotateCommand {
  return { type: 'ROTATE', options: { elementIds, angle } };
}

export function createTransformCommand(
  elementIds: string[],
  matrix: [number, number, number, number, number, number],
): TransformCommand {
  return { type: 'TRANSFORM', options: { elementIds, matrix } };
}
