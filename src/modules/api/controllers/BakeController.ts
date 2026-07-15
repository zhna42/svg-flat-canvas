import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { ImageElement } from '@/core/shapes/elements/ImageElement';
import type { SvgCanvas } from '@/canvas/SvgCanvas';

let _idCounter = 0;
const genId = (): string =>
  crypto.randomUUID?.() ?? `baked_${Date.now()}_${++_idCounter}`;

export class BakeController {
  private readonly canvas: SvgCanvas;

  constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  bake(elementIds: string[]): void {
    const shapes = elementIds
      .map((id) => this.canvas.shapeManager.getById(id))
      .filter((s): s is AbstractGraphicElement => s !== undefined);

    if (shapes.length === 0) return;

    // Сортируем по текущему Z-индексу (порядок в DOM)
    shapes.sort(
      (a, b) =>
        this.canvas.view._elementIndex.getIndex(a.id) -
        this.canvas.view._elementIndex.getIndex(b.id),
    );

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

      if (s.type === 'image') {
        clone.removeAttribute('clip-path');
      } else {
        this._blackenClone(clone);
      }

      wrapper.appendChild(clone);
    }

    tempSvg.appendChild(wrapper);

    const svgString = new XMLSerializer().serializeToString(tempSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const MAX_DIM = 4096;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const cw = Math.ceil(w * scale);
    const ch = Math.ceil(h * scale);

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = cw;
    renderCanvas.height = ch;
    const ctx = renderCanvas.getContext('2d')!;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);

      const dataUrl = renderCanvas.toDataURL('image/png');
      URL.revokeObjectURL(svgUrl);

      const ids = shapes.map((s) => s.id);
      for (const id of ids) {
        this.canvas.shapeManager.removeElementAndNode(id);
      }

      const newImage = new ImageElement(genId());
      newImage.geometry = { x: minX, y: minY, width: w, height: h };
      newImage.href = dataUrl;
      newImage.rebuildHitArea();
      newImage.clearTimeMachineDiff();

      this.canvas.elementManager.addShape(newImage);
      this.canvas.selectionState.replace([newImage]);
    };
    img.onerror = (e) => {
      console.warn('[Bake] SVG failed to load', e);
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  }

  private _blackenClone(clone: SVGElement): void {
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
