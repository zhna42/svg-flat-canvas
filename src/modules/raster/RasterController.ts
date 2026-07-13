import type { SvgCanvas } from '@/canvas/SvgCanvas';
import { ImageElement } from '@/core/shapes/elements/ImageElement';
import { RasterProcessor } from './RasterProcessor';
import type { DitherAlgorithm, DitherOptions, RasterState } from './types';

export class RasterController {
  constructor(private canvas: SvgCanvas) {}

  getState(elementId: string): RasterState | null {
    const el = this.findImage(elementId);
    if (!el) return null;

    const rasterState = el.rasterState ?? {
      algorithm: 'floyd-steinberg' as DitherAlgorithm,
      params: {} as DitherOptions,
    };

    return {
      elementId: el.id,
      originalImage: el.originalImage,
      processedSource: el.processedSource,
      editedImage: el.editedImage,
      algorithm: rasterState.algorithm,
      params: rasterState.params,
    };
  }

  setProcessedSource(elementId: string, base64: string): void {
    const el = this.findImage(elementId);
    if (!el) return;
    el.processedSource = base64;
  }

  setEditedImage(elementId: string, base64: string): void {
    const el = this.findImage(elementId);
    if (!el) return;
    el.editedImage = base64;
  }

  async applyDithering(
    elementId: string,
    algorithm: DitherAlgorithm,
    options: DitherOptions,
  ): Promise<void> {
    const el = this.findImage(elementId);
    if (!el) return;

    const sourceBase64 = el.processedSource || el.originalImage || el.href;
    if (!sourceBase64) return;

    const imageData = await RasterProcessor.imageDataFromBase64(sourceBase64);
    const grayscale = RasterProcessor.prepareGrayscale(imageData, options);
    const dithered = RasterProcessor.applyAlgorithm(
      grayscale,
      algorithm,
      options,
    );
    const resultBase64 = RasterProcessor.imageDataToBase64(dithered);

    el.editedImage = resultBase64;
    el.rasterState = { algorithm, params: options };
  }

  reset(elementId: string): void {
    const el = this.findImage(elementId);
    if (!el) return;
    el.editedImage = undefined;
    el.processedSource = undefined;
    el.rasterState = undefined;
  }

  private findImage(elementId: string): ImageElement | null {
    const el = this.canvas.shapeManager.getById(elementId);
    if (el && el.type === 'image') return el as ImageElement;
    return null;
  }
}
