import type { LayerName } from '@/core/type';
import type { TextChunk } from '@/core/shapes/elements/TextElement';
import { layoutText } from '@/modules/text/TextLayout';
import { MM_TO_PX } from '@/constants';

export class CanvasTextRenderer {
  readonly _elements: Map<string, SVGElement>;
  readonly _layers: Map<LayerName, SVGGElement>;
  _textEls = new Map<string, SVGElement>();

  constructor(
    elements: Map<string, SVGElement>,
    layers: Map<LayerName, SVGGElement>,
  ) {
    this._elements = elements;
    this._layers = layers;
  }

  sync(
    id: string,
    layerName: string | undefined,
    diff: Record<string, unknown>,
  ): void {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    let g = this._elements.get(id);
    if (!g || g.tagName.toLowerCase() !== 'g') {
      if (g) g.remove();
      const layer = this._layers.get((layerName as LayerName) ?? 'shapesGroup');
      if (!layer) return;
      g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
      g.setAttribute('id', id);
      layer.appendChild(g);
      this._elements.set(id, g);
    }

    let textEl = this._textEls.get(id);
    if (!textEl) {
      textEl = document.createElementNS(SVG_NS, 'text') as SVGElement;
      this._textEls.set(id, textEl);
    }

    if (diff.transform !== undefined)
      g.setAttribute('transform', String(diff.transform));
    if (diff.visibility !== undefined)
      g.setAttribute('visibility', String(diff.visibility));
    if (diff.opacity !== undefined)
      g.setAttribute('opacity', String(diff.opacity));

    const modelRaw = diff._model;
    let model: TextChunk[] = [];
    if (typeof modelRaw === 'string') {
      try {
        model = JSON.parse(modelRaw);
      } catch {
        model = [];
      }
    }

    const boxX = parseFloat(String(diff._boxX ?? '0'));
    const boxY = parseFloat(String(diff._boxY ?? '0'));
    const boxWidth = parseFloat(String(diff._boxWidth ?? '100'));
    const boxHeight = parseFloat(String(diff._boxHeight ?? '40'));
    const align = String(diff._align ?? 'left');
    const lineHeight = parseFloat(String(diff._lineHeight ?? '1.2'));
    const caretIdx = parseInt(String(diff._caretIdx ?? '-1'), 10);
    const selStart = parseInt(String(diff._selStart ?? '-1'), 10);
    const selEnd = parseInt(String(diff._selEnd ?? '-1'), 10);
    const editing = diff._editing === '1';

    const hasText = model.some((c) => c.text.trim().length > 0);
    const isPreview = diff._isPreview === '1';

    let boxRect: SVGRectElement | null = g.querySelector(':scope > rect');
    if (hasText || !isPreview) {
      if (boxRect) boxRect.remove();
    } else {
      if (!boxRect) {
        boxRect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
        boxRect.setAttribute('fill', 'none');
        boxRect.setAttribute('stroke', '#000000');
        boxRect.setAttribute('stroke-width', String(1000));
        boxRect.setAttribute('pointer-events', 'none');
        g.insertBefore(boxRect, g.firstChild);
      }
      boxRect.setAttribute('x', String(boxX));
      boxRect.setAttribute('y', String(boxY));
      boxRect.setAttribute('width', String(Math.max(boxWidth, 1)));
      boxRect.setAttribute('height', String(Math.max(boxHeight, 1)));
    }

    if (!g.contains(textEl)) {
      g.appendChild(textEl);
    }

    const layout = layoutText(model, boxWidth);

    while (textEl.firstChild) {
      textEl.removeChild(textEl.firstChild);
    }

    let baseY = boxY;
    const lineYPositions: number[] = [];

    for (let li = 0; li < layout.lines.length; li++) {
      const line = layout.lines[li];
      const lineDy = line.maxFontSize * lineHeight * MM_TO_PX;
      const lineY = baseY + line.maxFontSize * MM_TO_PX;
      lineYPositions.push(baseY);

      let xOffset: number;
      if (align === 'center') {
        xOffset = boxX + (boxWidth - line.width) / 2;
      } else if (align === 'right') {
        xOffset = boxX + boxWidth - line.width;
      } else {
        xOffset = boxX;
      }

      let isFirstSeg = true;

      for (const seg of line.segments) {
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.textContent = seg.text;

        if (isFirstSeg) {
          tspan.setAttribute('x', String(xOffset));
          tspan.setAttribute('y', String(lineY));
          isFirstSeg = false;
        }

        tspan.setAttribute('font-size', String(seg.fontSize * MM_TO_PX));
        tspan.setAttribute('font-family', seg.fontFamily);
        tspan.setAttribute('font-weight', seg.fontWeight);
        if (seg.fontStyle === 'italic')
          tspan.setAttribute('font-style', 'italic');
        tspan.setAttribute('fill', seg.color);

        if (seg.letterSpacing)
          tspan.setAttribute(
            'letter-spacing',
            String(seg.letterSpacing * MM_TO_PX),
          );

        if (seg.underline || seg.strike) {
          const deco: string[] = [];
          if (seg.underline) deco.push('underline');
          if (seg.strike) deco.push('line-through');
          tspan.setAttribute('text-decoration', deco.join(' '));
        }

        textEl!.appendChild(tspan);
      }

      baseY += lineDy;
    }

    this._syncUiOverlay(
      g,
      SVG_NS,
      textEl,
      layout,
      boxX,
      boxY,
      lineYPositions,
      caretIdx,
      selStart,
      selEnd,
      editing,
    );
  }

  private _syncUiOverlay(
    g: SVGElement,
    NS: string,
    textEl: SVGElement,
    layout: ReturnType<typeof layoutText>,
    boxX: number,
    boxY: number,
    lineYs: number[],
    caretIdx: number,
    selStart: number,
    selEnd: number,
    editing: boolean,
  ): void {
    let caretLine: SVGLineElement | null = g.querySelector(
      ':scope > .text-caret',
    );
    let selPoly: SVGPolygonElement | null = g.querySelector(
      ':scope > .text-selection',
    );
    let styleEl: HTMLStyleElement | null = g.querySelector(
      ':scope > .text-caret-style',
    );

    if (!editing) {
      if (caretLine) caretLine.remove();
      if (selPoly) selPoly.remove();
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.className = 'text-caret-style';
      styleEl.textContent =
        '@keyframes caret-blink{0%,100%{opacity:1}50%{opacity:0}}.text-caret{animation:caret-blink 0.6s infinite}';
      g.insertBefore(styleEl, g.firstChild);
    }

    const fullLen = (textEl.textContent ?? '').length;

    if (!selPoly) {
      selPoly = document.createElementNS(NS, 'polygon') as SVGPolygonElement;
      selPoly.setAttribute('fill', 'rgba(0,120,215,0.3)');
      selPoly.classList.add('text-selection');
      g.appendChild(selPoly);
    }

    let offset = 0;
    const allPolys: number[][] = [];

    for (let l = 0; l < layout.lines.length; l++) {
      const line = layout.lines[l];
      const lineLen = line.segments.reduce((s, seg) => s + seg.text.length, 0);
      const ls = Math.max(selStart - offset, 0);
      const le = Math.min(selEnd - offset, lineLen);

      if (le > ls) {
        const lineBaseY = lineYs[l] || boxY;
        const lineH = (line.maxFontSize || 4) * MM_TO_PX;
        const r1 = this._getCharRectFromDom(textEl, offset + ls, fullLen, boxX, lineH, lineBaseY);
        const r2 = this._getCharRectFromDom(textEl, offset + le - 1, fullLen, boxX, lineH, lineBaseY);

        allPolys.push([
          r1.x,
          lineBaseY,
          r2.x + r2.w,
          lineBaseY,
          r2.x + r2.w,
          lineBaseY + lineH,
          r1.x,
          lineBaseY + lineH,
        ]);
      }

      offset += lineLen;
    }

    if (allPolys.length > 0) {
      selPoly.setAttribute('points', allPolys.flat().join(' '));
      selPoly.style.display = '';
    } else {
      selPoly.style.display = 'none';
    }

    if (!caretLine) {
      caretLine = document.createElementNS(NS, 'line') as SVGLineElement;
      caretLine.setAttribute('stroke', '#000000');
      caretLine.setAttribute('stroke-width', '2');
      caretLine.setAttribute('vector-effect', 'non-scaling-stroke');
      caretLine.classList.add('text-caret');
      g.appendChild(caretLine);
    }

    if (caretIdx < 0) {
      caretLine.style.display = 'none';
      return;
    }

    let co = 0;
    let found = false;

    for (let l = 0; l < layout.lines.length && !found; l++) {
      const line = layout.lines[l];
      const lineLen = line.segments.reduce((s, seg) => s + seg.text.length, 0);

      if (caretIdx >= co && caretIdx <= co + lineLen) {
        const lineBaseY = lineYs[l] || boxY;
        const lineH = (line.maxFontSize || 4) * MM_TO_PX;
        const rect = this._getCharRectFromDom(textEl, caretIdx, fullLen, boxX, lineH, lineBaseY);

        caretLine.setAttribute('x1', String(rect.x));
        caretLine.setAttribute('y1', String(rect.y));
        caretLine.setAttribute('x2', String(rect.x));
        caretLine.setAttribute('y2', String(rect.y + rect.h));
        caretLine.style.display = '';
        found = true;
      }

      co += lineLen;
    }

    if (!found) {
      if (layout.lines.length > 0) {
        const li = layout.lines.length - 1;
        const lastLine = layout.lines[li];
        const lastBaseY = lineYs[li] || boxY;
        const lineH = (lastLine.maxFontSize || 4) * MM_TO_PX;
        const rect = this._getCharRectFromDom(textEl, fullLen - 1, fullLen, boxX, lineH, lastBaseY);

        caretLine.setAttribute('x1', String(rect.x + rect.w));
        caretLine.setAttribute('y1', String(rect.y));
        caretLine.setAttribute('x2', String(rect.x + rect.w));
        caretLine.setAttribute('y2', String(rect.y + rect.h));
        caretLine.style.display = '';
      } else {
        const lineH = 4 * MM_TO_PX;
        caretLine.setAttribute('x1', String(boxX));
        caretLine.setAttribute('y1', String(boxY));
        caretLine.setAttribute('x2', String(boxX));
        caretLine.setAttribute('y2', String(boxY + lineH));
        caretLine.style.display = '';
      }
    }
  }

  private _getCharRectFromDom(
    textEl: SVGElement,
    charIdx: number,
    fullLen: number,
    fallbackX: number,
    fallbackH: number,
    fallbackY: number,
  ): { x: number; y: number; w: number; h: number } {
    const g = textEl as unknown as {
      getExtentOfChar?: (i: number) => { x: number; y: number; width: number; height: number };
    };

    if (fullLen === 0 || typeof g.getExtentOfChar !== 'function') {
      return { x: fallbackX, y: fallbackY, w: 2, h: fallbackH };
    }

    const idx = Math.max(0, Math.min(charIdx, fullLen - 1));

    try {
      const ext = g.getExtentOfChar(idx);
      const after = charIdx >= fullLen;
      return {
        x: after ? ext.x + ext.width : ext.x,
        y: ext.y,
        w: 2,
        h: ext.height,
      };
    } catch {
      return { x: fallbackX, y: fallbackY, w: 2, h: fallbackH };
    }
  }

  getTextElement(id: string): SVGElement | undefined {
    return this._textEls.get(id);
  }

  measureBBox(
    id: string,
  ): { x: number; y: number; width: number; height: number } | null {
    const el = this._elements.get(id);
    const g = el as unknown as SVGGraphicsElement;
    if (g && typeof g.getBBox === 'function') {
      try {
        const b = g.getBBox();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      } catch {
        return null;
      }
    }
    return null;
  }
}
