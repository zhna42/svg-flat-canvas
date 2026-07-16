import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { createFromJSON } from '@/core/shapes/factory';
import type { SvgCanvas } from '@/canvas/SvgCanvas';
import { contours } from 'd3-contour';
import simplify from 'simplify-js';
import fitCurve from 'fit-curves';

let _idCounter = 0;
const genId = (): string =>
  crypto.randomUUID?.() ?? `merged_${Date.now()}_${++_idCounter}`;

export class MergeController {
  private readonly canvas: SvgCanvas;

  constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  merge(elementIds: string[]): void {
    const shapes = elementIds
      .map((id) => this.canvas.shapeManager.getById(id))
      .filter((s): s is AbstractGraphicElement => s !== undefined);

    if (shapes.length === 0) return;

    const badIds = shapes
      .filter((s) => s.type === 'image')
      .map((s) => s.id);
    if (badIds.length > 0) {
      this.canvas.events.emit('MERGE_WARNING', { badIds });
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of shapes) {
      const b = s.getTransformedBBox();
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    const w = Math.ceil(maxX - minX) || 1;
    const h = Math.ceil(maxY - minY) || 1;

    const NS = 'http://www.w3.org/2000/svg';
    const tempSvg = document.createElementNS(NS, 'svg');
    tempSvg.setAttribute('xmlns', NS);
    tempSvg.setAttribute('width', String(w));
    tempSvg.setAttribute('height', String(h));
    tempSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', '#ffffff');
    tempSvg.appendChild(bg);

    const wrapper = document.createElementNS(NS, 'g');
    wrapper.setAttribute('transform', `translate(${-minX}, ${-minY})`);

    for (const s of shapes) {
      const dom = this.canvas.view._elements.get(s.id);
      if (!dom) continue;
      const clone = dom.cloneNode(true) as SVGElement;
      clone.removeAttribute('id');
      this._blacken(clone);
      wrapper.appendChild(clone);
    }

    tempSvg.appendChild(wrapper);

    const svgString = new XMLSerializer().serializeToString(tempSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const MAX_DIM = 2048;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const cw = Math.ceil(w * scale);
    const ch = Math.ceil(h * scale);

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = cw;
    renderCanvas.height = ch;
    const ctx = renderCanvas.getContext('2d')!;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, cw, ch);
      const imageData = ctx.getImageData(0, 0, cw, ch);
      URL.revokeObjectURL(svgUrl);

      const paths = this._extractContours(imageData, scale, minX, minY, w, h);
      if (paths.length === 0) return;

      for (const id of elementIds) {
        this.canvas.shapeManager.removeElementAndNode(id);
      }

      const newShapes: AbstractGraphicElement[] = [];
      for (const d of paths) {
        const el = createFromJSON({
          type: 'path',
          id: genId(),
          attributes: { d, fill: '#000000', stroke: 'none' },
        });
        if (!el) continue;
        el.rebuildHitArea();
        el.clearTimeMachineDiff();
        this.canvas.elementManager.addShape(el);
        newShapes.push(el);
      }

      if (newShapes.length > 0) {
        this.canvas.selectionState.replace(newShapes);
      }
    };
    img.onerror = () => URL.revokeObjectURL(svgUrl);
    img.src = svgUrl;
  }

  private _extractContours(
    imageData: ImageData,
    scale: number,
    offsetX: number, offsetY: number,
    w: number, h: number,
  ): string[] {
    const { data, width, height } = imageData;
    const grid = new Float64Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        grid[y * width + x] = 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      }
    }

    const c = contours().size([width, height]);
    const threshold = c.contour(grid, 0.5);

    if (!threshold?.coordinates) return [];

    const result: string[] = [];
    const invScale = 1 / scale;
    const simplifyTolerance = Math.max(1, Math.sqrt(w * w + h * h) * 0.0005);
    const curveError = Math.max(1, simplifyTolerance * 0.5);

    for (const polygon of threshold.coordinates) {
      for (const ring of polygon) {
        const points = ring.map(
          ([px, py]: [number, number]) => [
            offsetX + px * invScale,
            offsetY + py * invScale,
          ] as [number, number],
        );
        if (points.length < 3) continue;

        const simplified = simplify(
          points.map(([x, y]) => ({ x, y })),
          simplifyTolerance,
          true,
        ).map((p) => [p.x, p.y] as [number, number]);

        if (simplified.length < 3) continue;

        let d = '';
        try {
          const curves = fitCurve(simplified, curveError);
          if (curves.length > 0) {
            const parts: string[] = [];
            for (let i = 0; i < curves.length; i++) {
              const [, [c1x, c1y], [c2x, c2y], [ex, ey]] = curves[i];
              const cmd = i === 0
                ? `M${curves[0][0][0].toFixed(0)},${curves[0][0][1].toFixed(0)} C${c1x.toFixed(0)},${c1y.toFixed(0)} ${c2x.toFixed(0)},${c2y.toFixed(0)} ${ex.toFixed(0)},${ey.toFixed(0)}`
                : `C${c1x.toFixed(0)},${c1y.toFixed(0)} ${c2x.toFixed(0)},${c2y.toFixed(0)} ${ex.toFixed(0)},${ey.toFixed(0)}`;
              parts.push(cmd);
            }
            d = parts.join(' ') + ' Z';
          }
        } catch { /* fall through */ }

        if (!d) {
          d = 'M ' + simplified
            .map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`)
            .join(' L ') + ' Z';
        }

        result.push(d);
      }
    }

    return result;
  }

  private _blacken(clone: SVGElement): void {
    const setRecursive = (el: Element) => {
      if (el instanceof SVGElement) {
        if (el.hasAttribute('fill') && el.getAttribute('fill') !== 'none') {
          el.setAttribute('fill', '#000000');
        }
        if (el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none') {
          el.setAttribute('stroke', '#000000');
        }
        el.removeAttribute('style');
        el.removeAttribute('opacity');
        el.removeAttribute('visibility');
      }
      for (let i = 0; i < el.children.length; i++) {
        setRecursive(el.children[i]);
      }
    };
    setRecursive(clone);
  }
}
