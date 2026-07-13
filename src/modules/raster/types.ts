export type DitherAlgorithm =
  | 'threshold'
  | 'floyd-steinberg'
  | 'atkinson'
  | 'bayer'
  | 'halftone';

export interface DitherOptions {
  threshold?: number;
  brightness?: number;
  contrast?: number;
  invert?: boolean;
  halftoneSize?: number;
  halftoneAngle?: number;
}

export interface RasterState {
  elementId: string;
  originalImage?: string;
  processedSource?: string;
  editedImage?: string;
  algorithm: DitherAlgorithm;
  params: DitherOptions;
}

export const DITHER_ALGORITHMS: { value: DitherAlgorithm; label: string }[] = [
  { value: 'threshold', label: 'Threshold' },
  { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'bayer', label: 'Bayer (Ordered)' },
  { value: 'halftone', label: 'Halftone' },
];
