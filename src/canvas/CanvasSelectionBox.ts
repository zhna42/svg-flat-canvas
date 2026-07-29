import type { NodeDOMFactory } from './NodeDOMFactory';
import type { LayerName } from '@/core/type';
import type { Camera } from './Camera';

interface BoxState {
  w: number;
  h: number;
}

const CX = 6000;
const CY = 6000;
const OFF_CORNER = 3500;
const OFF_EDGE = 6000;

export class CanvasSelectionBox {
  _selectionDOMs = new Map<string, Map<string, SVGElement>>();
  _boxStates = new Map<string, BoxState>();

  readonly _factory: NodeDOMFactory;
  readonly _layers: Map<LayerName, SVGGElement>;
  readonly _camera: Camera;

  constructor(
    factory: NodeDOMFactory,
    layers: Map<LayerName, SVGGElement>,
    camera: Camera,
  ) {
    this._factory = factory;
    this._layers = layers;
    this._camera = camera;
  }

  draw(diff: Record<string, unknown>): string | null {
    const visible = diff.visible !== false;
    let domRef = (diff._domRef as string) || '';
    const layerName = (diff._layerName as string) || 'selectionOverlay';

    if (!visible && domRef) {
      const els = this._selectionDOMs.get(domRef);
      if (els) {
        els.get('g')?.remove();
        this._selectionDOMs.delete(domRef);
        this._boxStates.delete(domRef);
      }
      return null;
    }
    if (!visible) return domRef || null;

    if (!domRef) {
      const { uuid, elements } = this._factory.createSelectionBox();
      this._selectionDOMs.set(uuid, elements);
      const targetLayer = this._layers.get(layerName as LayerName);
      if (targetLayer) targetLayer.appendChild(elements.get('g')!);
      domRef = uuid;
    }

    const els = this._selectionDOMs.get(domRef);
    if (!els) return domRef;

    const g = els.get('g')!;
    const rectBg = els.get('rect-bg')!;
    const rectFg = els.get('rect-fg')!;

    const x =
      typeof diff.x === 'number'
        ? diff.x
        : parseFloat(g.getAttribute('data-x') || '0');
    const y =
      typeof diff.y === 'number'
        ? diff.y
        : parseFloat(g.getAttribute('data-y') || '0');
    const angle =
      typeof diff.angle === 'number'
        ? diff.angle
        : parseFloat(g.getAttribute('data-angle') || '0');
    const w =
      typeof diff.width === 'number'
        ? diff.width
        : parseFloat(rectBg.getAttribute('data-w') || '0');
    const h =
      typeof diff.height === 'number'
        ? diff.height
        : parseFloat(rectBg.getAttribute('data-h') || '0');

    const rcx = w / 2;
    const rcy = h / 2;
    g.setAttribute(
      'transform',
      `translate(${x}, ${y}) rotate(${angle}, ${rcx}, ${rcy})`,
    );
    g.setAttribute('data-x', String(x));
    g.setAttribute('data-y', String(y));
    g.setAttribute('data-angle', String(angle));
    g.setAttribute('visibility', 'visible');

    const inset = 0.75;
    const innerW = Math.max(w - 1.5, 0);
    const innerH = Math.max(h - 1.5, 0);

    for (const r of [rectBg, rectFg]) {
      r.setAttribute('x', String(inset));
      r.setAttribute('y', String(inset));
      r.setAttribute('width', String(innerW));
      r.setAttribute('height', String(innerH));
    }
    rectBg.setAttribute('data-w', String(w));
    rectBg.setAttribute('data-h', String(h));

    this._boxStates.set(domRef, { w, h });
    this._applyHandles(els, domRef);

    return domRef;
  }

  public refreshHandles(): void {
    for (const [domRef, els] of this._selectionDOMs) {
      this._applyHandles(els, domRef);
    }
  }

  private _applyHandles(
    els: Map<string, SVGElement>,
    domRef: string,
  ): void {
    const state = this._boxStates.get(domRef);
    if (!state) return;
    const { w, h } = state;
    const zoom = this._camera.zoom;
    const invZoom = 1 / zoom;
    const offCorner = OFF_CORNER / zoom;
    const offEdge = OFF_EDGE / zoom;
    const hw = w / 2;
    const hh = h / 2;

    const data: Array<{
      key: string;
      hx: number;
      hy: number;
      rot: number;
    }> = [
      { key: 'h-nw', hx: 0 - offCorner, hy: 0 - offCorner, rot: 315 },
      { key: 'h-n', hx: hw, hy: 0 - offEdge, rot: 0 },
      { key: 'h-ne', hx: w + offCorner, hy: 0 - offCorner, rot: 45 },
      { key: 'h-e', hx: w + offEdge, hy: hh, rot: 90 },
      { key: 'h-se', hx: w + offCorner, hy: h + offCorner, rot: 135 },
      { key: 'h-s', hx: hw, hy: h + offEdge, rot: 0 },
      { key: 'h-sw', hx: 0 - offCorner, hy: h + offCorner, rot: 225 },
      { key: 'h-w', hx: 0 - offEdge, hy: hh, rot: 270 },
    ];

    for (const hd of data) {
      const handle = els.get(hd.key);
      if (handle) {
        handle.setAttribute(
          'transform',
          `translate(${hd.hx}, ${hd.hy}) scale(${invZoom}) rotate(${hd.rot}) translate(${-CX}, ${-CY})`,
        );
      }
    }
  }
}
