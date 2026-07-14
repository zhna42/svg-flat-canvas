import type { LayerName } from '@/core/type';

export class CanvasTextRenderer {
  _textDivs = new Map<string, HTMLDivElement>();

  readonly _elements: Map<string, SVGElement>;
  readonly _layers: Map<LayerName, SVGGElement>;

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
    const XHTML_NS = 'http://www.w3.org/1999/xhtml';
    const isRich = diff._rich === '1';
    const desiredTag = isRich ? 'foreignObject' : 'text';

    let el = this._elements.get(id);
    if (!el || el.tagName.toLowerCase() !== desiredTag.toLowerCase()) {
      if (el) el.remove();
      this._textDivs.delete(id);
      const layer = this._layers.get((layerName as LayerName) ?? 'shapesGroup');
      if (!layer) return;
      el = document.createElementNS(SVG_NS, desiredTag) as SVGElement;
      el.setAttribute('id', id);
      layer.appendChild(el);
      this._elements.set(id, el);
    }

    if (diff.transform !== undefined)
      el.setAttribute('transform', String(diff.transform));
    if (diff.visibility !== undefined)
      el.setAttribute('visibility', String(diff.visibility));
    if (diff.opacity !== undefined)
      el.setAttribute('opacity', String(diff.opacity));

    if (!isRich) {
      const setA = (k: string, v: unknown): void => {
        if (v !== undefined) el!.setAttribute(k, String(v));
      };
      setA('x', diff.x);
      setA('y', diff.y);
      setA('font-size', diff['font-size']);
      setA('font-family', diff['font-family']);
      setA('text-anchor', diff['text-anchor']);
      setA('fill', diff.fill);
      el.textContent = String(diff._content ?? '');
      return;
    }

    el.setAttribute('x', String(diff.x ?? '0'));
    el.setAttribute('y', String(diff.y ?? '0'));
    el.setAttribute('width', String(diff.width ?? '0'));
    el.setAttribute('height', String(diff.height ?? '0'));

    let div = this._textDivs.get(id);
    if (!div) {
      div = document.createElementNS(
        XHTML_NS,
        'div',
      ) as unknown as HTMLDivElement;
      el.appendChild(div);
      this._textDivs.set(id, div);
    }
    const deco: string[] = [];
    if (diff._underline === '1') deco.push('underline');
    if (diff._strike === '1') deco.push('line-through');
    const isEmpty = !String(diff._content ?? '')
      .replace(/<[^>]*>/g, '')
      .trim();
    div.setAttribute(
      'style',
      [
        'width:100%',
        'height:100%',
        'overflow:hidden',
        'box-sizing:border-box',
        'white-space:pre-wrap',
        'word-break:break-word',
        'outline:none',
        `font-family:${diff._fontFamily || 'sans-serif'}`,
        `font-size:${diff._fontSize ?? '16'}px`,
        `color:${diff._color ?? '#000'}`,
        `font-weight:${diff._fontWeight ?? '400'}`,
        `font-style:${diff._italic === '1' ? 'italic' : 'normal'}`,
        `text-decoration:${deco.length ? deco.join(' ') : 'none'}`,
        `text-align:${diff._align ?? 'left'}`,
        `line-height:${diff._lineHeight ?? '1.2'}`,
        isEmpty
          ? 'background:rgba(255,255,255,0.15);border:1px solid #000;'
          : '',
      ].join(';'),
    );
    if (!div.isContentEditable) {
      div.innerHTML = String(diff._content ?? '');
    }
  }

  getForeignObject(id: string): SVGElement | undefined {
    return this._elements.get(id);
  }

  getDiv(id: string): HTMLDivElement | undefined {
    return this._textDivs.get(id);
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
