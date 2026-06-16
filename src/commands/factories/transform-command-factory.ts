import type {
  ResizeCommand,
  RotateCommand,
  TransformCommand,
  BBox,
} from '../types';

export const createResizeCommand = (
  elementIds: string[],
  bbox: BBox,
): ResizeCommand => ({ type: 'RESIZE', options: { elementIds, bbox } });

export const createRotateCommand = (
  elementIds: string[],
  angle: number,
): RotateCommand => ({ type: 'ROTATE', options: { elementIds, angle } });

export const createTransformCommand = (
  elementIds: string[],
  matrix: [number, number, number, number, number, number],
): TransformCommand => ({
  type: 'TRANSFORM',
  options: { elementIds, matrix },
});
