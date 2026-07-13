import CanvasDither from 'canvas-dither';
import type { DitherAlgorithm, DitherOptions } from './types';

export class RasterProcessor {
  static prepareGrayscale(
    imageData: ImageData,
    options: DitherOptions,
  ): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(
      new Uint8ClampedArray(data.length),
      width,
      height,
    );
    const outData = output.data;

    const contrast = options.contrast ?? 0;
    const brightness = options.brightness ?? 0;
    const invert = options.invert ?? false;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) {
        const v = invert ? 0 : 255;
        outData[i] = v;
        outData[i + 1] = v;
        outData[i + 2] = v;
        outData[i + 3] = 255;
        continue;
      }

      let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray = factor * (gray - 128) + 128 + brightness;

      if (gray < 0) gray = 0;
      if (gray > 255) gray = 255;
      if (invert) gray = 255 - gray;

      const finalVal = Math.round(gray);
      outData[i] = finalVal;
      outData[i + 1] = finalVal;
      outData[i + 2] = finalVal;
      outData[i + 3] = 255;
    }

    return output;
  }

  static applyAlgorithm(
    imageData: ImageData,
    algorithm: DitherAlgorithm,
    options: DitherOptions,
  ): ImageData {
    const threshold = options.threshold ?? 128;

    switch (algorithm) {
      case 'threshold':
        return CanvasDither.threshold(imageData, threshold);
      case 'floyd-steinberg':
        return CanvasDither.floydsteinberg(imageData);
      case 'atkinson':
        return CanvasDither.atkinson(imageData);
      case 'bayer':
        return CanvasDither.bayer(imageData, threshold);
      case 'halftone':
        return RasterProcessor.applyHalftone(
          imageData,
          options.halftoneSize ?? 4,
          options.halftoneAngle ?? 0,
        );
      default:
        return CanvasDither.floydsteinberg(imageData);
    }
  }

  static applyHalftone(
    imageData: ImageData,
    size: number,
    angleDeg: number,
  ): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(
      new Uint8ClampedArray(data.length),
      width,
      height,
    );
    const outData = output.data;

    const angleRad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const half = size / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = data[idx];

        const rx = x * cosA - y * sinA;
        const ry = x * sinA + y * cosA;

        const localX = ((rx % size) + size) % size;
        const localY = ((ry % size) + size) % size;

        const dx = localX - half + 0.5;
        const dy = localY - half + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxRadius = half * 0.85;
        const dotRadius = (1 - gray / 255) * maxRadius;

        const value = dist <= dotRadius ? 0 : 255;
        outData[idx] = value;
        outData[idx + 1] = value;
        outData[idx + 2] = value;
        outData[idx + 3] = 255;
      }
    }

    return output;
  }

  static async imageDataFromBase64(src: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = (): void => {
        // eslint-disable-next-line custom-rules/no-dom-api
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || img.width || 64;
        const h = img.naturalHeight || img.height || 64;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(ctx.getImageData(0, 0, w, h));
        } catch (e) {
          reject(new Error('Canvas tainted by cross-origin image'));
        }
      };
      img.onerror = (): void => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
      img.src = src;
    });
  }

  static imageDataToBase64(imageData: ImageData): string {
    // eslint-disable-next-line custom-rules/no-dom-api
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
