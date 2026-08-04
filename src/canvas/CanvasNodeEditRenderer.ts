import type { LayerName } from '@/core/type';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ACCENT = '#4285f4';
const FILL = '#ffffff';
const LINE_COLOR = '#a0a0a0';
const STROKE_W = 6;
const LINE_W = 5;

export class CanvasNodeEditRenderer {
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
    let g = this._elements.get(id);
    if (!g || g.tagName.toLowerCase() !== 'g') {
      if (g) g.remove();
      const layer = this._layers.get((layerName as LayerName) ?? 'shapesGroup');
      if (!layer) return;
      g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
      g.setAttribute('id', id);
      g.setAttribute('pointer-events', 'none');
      layer.appendChild(g);
      this._elements.set(id, g);
    }

    const anchorsRaw = diff._anchors;
    const controlsRaw = diff._controls;
    const linesRaw = diff._lines;

    if (typeof anchorsRaw === 'string')
      this._syncAnchors(g, JSON.parse(anchorsRaw));
    if (typeof controlsRaw === 'string')
      this._syncControls(g, JSON.parse(controlsRaw));
    if (typeof linesRaw === 'string') this._syncLines(g, JSON.parse(linesRaw));
  }

  private _syncAnchors(
    g: SVGElement,
    data: Record<
      string,
      { x: number; y: number; w: number; h: number; kind: string }
    >,
  ): void {
    const existing = new Map<string, SVGElement>();
    for (const el of g.querySelectorAll('[data-node-id]')) {
      const e = el as SVGElement;
      existing.set(e.getAttribute('data-node-id')!, e);
    }

    for (const [nodeId, rect] of Object.entries(data)) {
      let el = existing.get(nodeId);
      const isCorner = rect.kind === 'corner';
      const isSymmetric = rect.kind === 'symmetric';

      if (el && !isSameAnchor(el, rect, isCorner, isSymmetric)) {
        el.remove();
        el = undefined;
      }

      if (!el) {
        const created = createAnchor(rect.kind, rect, g);
        created.setAttribute('data-node-id', nodeId);
        el = created;
      }

      updateAnchor(el, rect, isCorner);
      existing.delete(nodeId);
    }

    for (const el of existing.values()) el.remove();
  }

  private _syncControls(
    g: SVGElement,
    data: Record<string, { cx: number; cy: number; r: number }>,
  ): void {
    const existing = new Map<string, SVGCircleElement>();
    for (const el of g.querySelectorAll('[data-ctrl-id]'))
      existing.set(el.getAttribute('data-ctrl-id')!, el as SVGCircleElement);

    for (const [ctrlId, c] of Object.entries(data)) {
      let el = existing.get(ctrlId);
      if (!el) {
        el = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
        el.setAttribute('fill', FILL);
        el.setAttribute('stroke', ACCENT);
        el.setAttribute('stroke-width', String(STROKE_W));
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('data-ctrl-id', ctrlId);
        g.appendChild(el);
      }
      el.setAttribute('r', String(c.r));
      el.setAttribute('cx', String(c.cx));
      el.setAttribute('cy', String(c.cy));
      existing.delete(ctrlId);
    }

    for (const el of existing.values()) el.remove();
  }

  private _syncLines(
    g: SVGElement,
    data: Record<string, { x1: number; y1: number; x2: number; y2: number }>,
  ): void {
    const existing = new Map<string, SVGLineElement>();
    for (const el of g.querySelectorAll('[data-line-id]'))
      existing.set(el.getAttribute('data-line-id')!, el as SVGLineElement);

    for (const [lineId, l] of Object.entries(data)) {
      let el = existing.get(lineId);
      if (!el) {
        el = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
        el.setAttribute('stroke', LINE_COLOR);
        el.setAttribute('stroke-width', String(LINE_W));
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('data-line-id', lineId);
        g.appendChild(el);
      }
      el.setAttribute('x1', String(l.x1));
      el.setAttribute('y1', String(l.y1));
      el.setAttribute('x2', String(l.x2));
      el.setAttribute('y2', String(l.y2));
      existing.delete(lineId);
    }

    for (const el of existing.values()) el.remove();
  }
}

function createAnchor(
  kind: string,
  rect: { x: number; y: number; w: number; h: number },
  g: SVGElement,
): SVGElement {
  if (kind === 'corner') {
    const r = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
    r.setAttribute('width', String(rect.w));
    r.setAttribute('height', String(rect.h));
    r.setAttribute('fill', FILL);
    r.setAttribute('stroke', ACCENT);
    r.setAttribute('stroke-width', String(STROKE_W));
    r.setAttribute('vector-effect', 'non-scaling-stroke');
    g.appendChild(r);
    return r;
  } else if (kind === 'symmetric') {
    const poly = document.createElementNS(
      SVG_NS,
      'polygon',
    ) as SVGPolygonElement;
    poly.setAttribute('fill', FILL);
    poly.setAttribute('stroke', ACCENT);
    poly.setAttribute('stroke-width', String(STROKE_W));
    poly.setAttribute('vector-effect', 'non-scaling-stroke');
    g.appendChild(poly);
    return poly;
  } else {
    const c = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
    c.setAttribute('r', String(rect.w / 2));
    c.setAttribute('fill', FILL);
    c.setAttribute('stroke', ACCENT);
    c.setAttribute('stroke-width', String(STROKE_W));
    c.setAttribute('vector-effect', 'non-scaling-stroke');
    g.appendChild(c);
    return c;
  }
}

function updateAnchor(
  el: SVGElement,
  rect: { x: number; y: number; w: number; h: number },
  isCorner: boolean,
): void {
  if (isCorner && el instanceof SVGRectElement) {
    el.setAttribute('x', String(rect.x));
    el.setAttribute('y', String(rect.y));
  } else if (el instanceof SVGPolygonElement) {
    const hw = rect.w / 2;
    const hh = rect.h / 2;
    el.setAttribute(
      'points',
      `${rect.x + hw},${rect.y} ${rect.x + rect.w},${rect.y + hh} ${rect.x + hw},${rect.y + rect.h} ${rect.x},${rect.y + hh}`,
    );
  } else if (el instanceof SVGCircleElement) {
    el.setAttribute('cx', String(rect.x + rect.w / 2));
    el.setAttribute('cy', String(rect.y + rect.h / 2));
  }
}

function isSameAnchor(
  el: SVGElement,
  _rect: { x: number; y: number; w: number; h: number; kind: string },
  isCorner: boolean,
  isSymmetric: boolean,
): boolean {
  return (
    (isCorner && el instanceof SVGRectElement) ||
    (isSymmetric && el instanceof SVGPolygonElement) ||
    (!isCorner && !isSymmetric && el instanceof SVGCircleElement)
  );
}
