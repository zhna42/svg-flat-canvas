import type { SvgCanvas } from '@/canvas/SvgCanvas';

export const guardEditMode = (canvas: SvgCanvas): boolean =>
  canvas.mode !== 'layers';
