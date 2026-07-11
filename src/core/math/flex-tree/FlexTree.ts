export type FlexTreeAlgorithm = 'linear' | 'wave' | 'cross';

export interface FlexTreeConfig {
  algorithm: FlexTreeAlgorithm;
  step: number;
  link: number;
  dash: number;
  amplitude: number;
}

export interface CutSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axis?: 'H' | 'V';
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_STEP = 1.5;
const MAX_STEP = 10.0;
const MIN_LINK = 1.5;
const MAX_LINK = 6.0;
const MIN_DASH = 10.0;
const MAX_DASH = 50.0;

export const FLEX_VALIDATION = {
  step: { min: MIN_STEP, max: MAX_STEP },
  link: { min: MIN_LINK, max: MAX_LINK },
  dash: { min: MIN_DASH, max: MAX_DASH },
};

export const FLEX_TREE_PRESETS = {
  thin: { step: 2.5, link: 2.0, dash: 20.0, amplitude: 1.0 },
  standard: { step: 3.5, link: 3.0, dash: 25.0, amplitude: 1.0 },
  thick: { step: 4.5, link: 4.0, dash: 30.0, amplitude: 1.0 },
} as const;

export class FlexTree {
  public algorithm: FlexTreeAlgorithm = 'linear';
  public step = 3.5;
  public link = 3.0;
  public dash = 25.0;
  public amplitude = 1.0;

  public generateCutData(bbox: BBox): CutSegment[] {
    switch (this.algorithm) {
      case 'linear':
        return generateLinearCuts(bbox, this.step, this.link, this.dash);
      case 'wave':
        return generateWaveCuts(
          bbox,
          this.step,
          this.link,
          this.dash,
          this.amplitude,
        );
      case 'cross':
        return generateCrossCuts(bbox, this.step, this.link, this.dash);
      default:
        return [];
    }
  }
}

function generateLinearCuts(
  bbox: BBox,
  step: number,
  link: number,
  dash: number,
): CutSegment[] {
  const segments: CutSegment[] = [];
  const period = dash + link;
  if (period <= 0 || step <= 0) return segments;

  for (let y = bbox.y; y <= bbox.y + bbox.height; y += step) {
    const rowIndex = Math.round((y - bbox.y) / step);
    const offsetX = (rowIndex % 2) * (period / 2);

    let x = bbox.x - period + (offsetX % period);
    while (x < bbox.x + bbox.width + period) {
      const s = x;
      const e = Math.min(x + dash, bbox.x + bbox.width + period);
      if (e > s) {
        const cx1 = Math.max(s, bbox.x);
        const cx2 = Math.min(e, bbox.x + bbox.width);
        if (cx2 > cx1) {
          segments.push({ x1: cx1, y1: y, x2: cx2, y2: y });
        }
      }
      x += period;
    }
  }
  return segments;
}

function generateWaveCuts(
  bbox: BBox,
  step: number,
  link: number,
  dash: number,
  amplitude: number,
): CutSegment[] {
  const segments: CutSegment[] = [];
  const period = dash + link;
  if (period <= 0 || step <= 0) return segments;

  const sampleStep = Math.min(0.5, dash / 10);

  for (let baseY = bbox.y; baseY <= bbox.y + bbox.height; baseY += step) {
    const rowIndex = Math.round((baseY - bbox.y) / step);
    const offsetX = (rowIndex % 2) * (period / 2);

    let segStart = bbox.x - period + (offsetX % period);
    while (segStart < bbox.x + bbox.width + period) {
      const segEnd = segStart + dash;
      let prevPx = segStart;
      let prevPy =
        baseY + amplitude * Math.sin((2 * Math.PI * segStart) / period);

      for (let sx = segStart + sampleStep; sx <= segEnd; sx += sampleStep) {
        const px = sx;
        const py = baseY + amplitude * Math.sin((2 * Math.PI * sx) / period);
        if (px >= bbox.x && px <= bbox.x + bbox.width) {
          segments.push({
            x1: Math.max(prevPx, bbox.x),
            y1: prevPy,
            x2: Math.min(px, bbox.x + bbox.width),
            y2: py,
          });
        }
        prevPx = px;
        prevPy = py;
      }
      segStart += period;
    }
  }
  return segments;
}

function generateCrossCuts(
  bbox: BBox,
  step: number,
  link: number,
  dash: number,
): CutSegment[] {
  const segments: CutSegment[] = [];
  const period = dash + link; // L + N
  if (step <= 0 || dash <= 0 || link <= 0) return segments;

  const { x, y, width, height } = bbox;
  const MIN_LEN = 1.0;
  const halfSpan = step / 4; // горизонталь шириной X/2 → по X/4 в каждую сторону от оси

  const cols = Math.floor(width / step);
  for (let i = 0; i <= cols; i++) {
    const vx = x + i * step;
    const yOffset = i % 2 !== 0 ? period / 2 : 0;

    // старт на период раньше — ловим ведущий частичный штрих у верхней границы
    let base = y + yOffset - period;
    while (base < y + height) {
      // вертикальный штрих [base .. base + dash]
      const segStart = Math.max(base, y);
      let endY = base + dash;
      if (endY > y + height) endY = y + height;
      if (endY - segStart > MIN_LEN) {
        segments.push({ x1: vx, y1: segStart, x2: vx, y2: endY, axis: 'V' });
      }

      // горизонтальный рез по центру зазора N, центрирован на оси колонки,
      // ширина X/2 (не пересекает вертикали, лежит в отступе)
      const gapCenter = base + dash + link / 2;
      if (gapCenter > y && gapCenter < y + height) {
        const hx1 = Math.max(vx - halfSpan, x);
        const hx2 = Math.min(vx + halfSpan, x + width);
        if (hx2 - hx1 > MIN_LEN) {
          segments.push({
            x1: hx1,
            y1: gapCenter,
            x2: hx2,
            y2: gapCenter,
            axis: 'H',
          });
        }
      }

      base += period;
    }
  }

  return segments;
}
