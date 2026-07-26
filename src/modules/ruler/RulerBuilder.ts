import { MM_TO_PX } from '@/constants';

export const RULER_SIZE_PX = 25;

export function getRulerSvgSize(svg: SVGSVGElement): {
  rsV: number;
  rsH: number;
} {
  const ctm = svg.getScreenCTM();
  const sx = ctm ? Math.abs(ctm.a) || 1 : 1;
  const sy = ctm ? Math.abs(ctm.d) || 1 : 1;
  return {
    rsV: RULER_SIZE_PX / sx,
    rsH: RULER_SIZE_PX / sy,
  };
}
const RULER_BG = '#fff';
const RULER_BORDER = '#888';
const RULER_TEXT_COLOR = '#555';
const RULER_TICK_COLOR = '#888';
const FONT_SIZE_BASE = 9;
const FONT_SIZE_SMALL = 8;

export interface RulerParams {
  visible: boolean;
  cameraX: number;
  cameraY: number;
  zoom: number;
  flipY: boolean;
  worldHeightPx: number;
}

export function getSvgViewportBounds(
  svg: SVGSVGElement,
  fallbackW = 800,
  fallbackH = 600,
): { w: number; h: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { w: fallbackW, h: fallbackH };
  const rect = svg.getBoundingClientRect();
  const inv = ctm.inverse();
  const p0 = svg.createSVGPoint();
  p0.x = rect.left;
  p0.y = rect.top;
  const p1 = svg.createSVGPoint();
  p1.x = rect.left + rect.width;
  p1.y = rect.top + rect.height;
  const v0 = p0.matrixTransform(inv);
  const v1 = p1.matrixTransform(inv);
  return { w: v1.x - v0.x, h: v1.y - v0.y };
}

export class RulerBuilder {
  constructor(private readonly svg: SVGSVGElement) {}

  public update(container: SVGGElement, params: RulerParams): void {
    container.setAttribute('pointer-events', 'none');
    container.setAttribute('visibility', params.visible ? 'visible' : 'hidden');
    if (!params.visible) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = this.buildMarkup(params);
  }

  private buildMarkup(params: RulerParams): string {
    const z = params.zoom;
    const panX = params.cameraX;
    const panY = params.cameraY;
    const flipY = params.flipY;
    const worldHPx = params.worldHeightPx;
    const worldHMm = worldHPx / MM_TO_PX;

    const ctm = this.svg.getScreenCTM();
    const svgToPx = ctm ? Math.abs(ctm.a) || 1 : 1;
    const sy = ctm ? Math.abs(ctm.d) || 1 : 1;
    const pxToSvg = 1 / svgToPx;
    const targetWorldUnits = (7 * pxToSvg) / z;
    const targetMm = targetWorldUnits / MM_TO_PX;
    const mmStep = this.niceStep(targetMm);
    const step = mmStep * MM_TO_PX;

    const bounds = getSvgViewportBounds(this.svg);
    const svgW = bounds.w;
    const svgH = bounds.h;
    const { rsV, rsH } = getRulerSvgSize(this.svg);

    const fontSize = FONT_SIZE_BASE / sy;
    const fontSizeSmall = FONT_SIZE_SMALL / sy;
    const lineW = 0.5 * MM_TO_PX;

    const padBottom = 6 / sy;
    const padRight = 4 / svgToPx;

    if (svgW < rsV || svgH < rsH) return '';

    let h = '';

    h += `<rect x="0" y="0" width="${rsV}" height="${rsH}" fill="${RULER_BG}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;
    if (panX < rsV && panY < rsH) {
      const cornerLabel = flipY ? this.formatMmLabel(worldHMm, mmStep) : '0';
      h += `<text x="${rsV - padRight}" y="${rsH - padBottom}" fill="${RULER_TEXT_COLOR}" font-size="${fontSizeSmall}" font-family="system-ui, sans-serif" text-anchor="end" dominant-baseline="text-after-edge">${cornerLabel}</text>`;
    }

    h += `<rect x="${rsV}" y="0" width="${svgW - rsV}" height="${rsH}" fill="${RULER_BG}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;
    h += `<line x1="${rsV}" y1="${rsH}" x2="${svgW}" y2="${rsH}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;

    h += `<rect x="0" y="${rsH}" width="${rsV}" height="${svgH - rsH}" fill="${RULER_BG}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;
    h += `<line x1="${rsV}" y1="${rsH}" x2="${rsV}" y2="${svgH}" stroke="${RULER_BORDER}" stroke-width="${lineW}"/>`;

    const stepPx = step * z;

    const startIdxH = Math.floor(-panX / stepPx);
    for (let i = startIdxH; ; i++) {
      const w = i * step;
      const sx = w * z + panX;
      if (sx >= svgW) break;
      if (sx < rsV) continue;
      const mmVal = w / MM_TO_PX;
      const tickType = this.getTickType(mmVal, mmStep);
      const len =
        tickType === 'major'
          ? rsH - 3 * (rsH / 25)
          : tickType === 'medium'
            ? rsH * 0.55
            : rsH * 0.3;
      h += `<line x1="${sx}" y1="${rsH - len}" x2="${sx}" y2="${rsH}" stroke="${RULER_TICK_COLOR}" stroke-width="${lineW}"/>`;
      if (tickType === 'major') {
        h += `<text x="${sx + 2}" y="${rsH - padBottom}" fill="${RULER_TEXT_COLOR}" font-size="${fontSize}" font-family="system-ui, sans-serif" dominant-baseline="text-after-edge">${this.formatMmLabel(mmVal, mmStep)}</text>`;
      }
    }

    const startIdxV = Math.floor(-panY / stepPx);
    const iBottom = flipY ? Math.round(worldHPx / step) : 0;
    const flipOffset = flipY ? worldHMm - iBottom * mmStep : 0;
    for (let i = startIdxV; ; i++) {
      const w = i * step;
      const sy = w * z + panY;
      if (sy >= svgH) break;
      if (sy < rsH) continue;
      const rawMmVal = flipY ? worldHMm - w / MM_TO_PX : w / MM_TO_PX;
      const tickType = flipY
        ? this.flippedTickType(i, iBottom, mmStep)
        : this.getTickType(rawMmVal, mmStep);
      const len =
        tickType === 'major'
          ? rsV - 3 * (rsV / 25)
          : tickType === 'medium'
            ? rsV * 0.55
            : rsV * 0.3;
      h += `<line x1="${rsV - len}" y1="${sy}" x2="${rsV}" y2="${sy}" stroke="${RULER_TICK_COLOR}" stroke-width="${lineW}"/>`;
      if (tickType === 'major') {
        const displayMmVal = flipY ? rawMmVal - flipOffset : rawMmVal;
        h += `<text x="${rsV - padRight}" y="${sy + 2}" fill="${RULER_TEXT_COLOR}" font-size="${fontSize}" font-family="system-ui, sans-serif" text-anchor="end" dominant-baseline="hanging">${this.formatMmLabel(displayMmVal, mmStep)}</text>`;
      }
    }

    return h;
  }

  private flippedTickType(
    i: number,
    iBottom: number,
    _mmStep: number,
  ): 'minor' | 'medium' | 'major' {
    const dist = Math.abs(i - iBottom);
    if (dist < 0.5) return 'major';
    const r10 = dist % 10;
    if (r10 < 0.5 || r10 > 9.5) return 'major';
    const r5 = dist % 5;
    if (r5 < 0.5 || r5 > 4.5) return 'medium';
    return 'minor';
  }

  private getTickType(
    mmVal: number,
    mmStep: number,
  ): 'minor' | 'medium' | 'major' {
    const r10 = Math.abs(mmVal % (mmStep * 10));
    if (r10 < 0.001 || Math.abs(r10 - mmStep * 10) < 0.001) return 'major';
    const r5 = Math.abs(mmVal % (mmStep * 5));
    if (r5 < 0.001 || Math.abs(r5 - mmStep * 5) < 0.001) return 'medium';
    return 'minor';
  }

  private niceStep(target: number): number {
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    for (const s of steps) {
      if (s >= target) return s;
    }
    return 1000;
  }

  private formatMmLabel(mmVal: number, mmStep: number): string {
    if (mmStep >= 1) return String(Math.round(mmVal));
    return parseFloat(mmVal.toFixed(1)).toString();
  }
}
