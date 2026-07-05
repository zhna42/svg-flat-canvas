import { NodeDOMFactory } from './NodeDOMFactory';
import { Camera } from './Camera';
import { DrawPayload, LayerName } from '@/types';

const SYSTEM_IDS = new Set([
  'camera',
  'artboard',
  'grid',
  'rulers',
  'selection',
  'selection-group',
]);

const TAG_BY_SYS_ID: Record<string, string> = {
  camera: 'g',
  artboard: 'rect',
  grid: 'g',
  rulers: 'g',
  selection: 'g',
  'selection-group': 'g',
};

export class CanvasView {
  readonly _svgRoot: SVGSVGElement;
  readonly _factory: NodeDOMFactory;
  readonly _camera: Camera;
  _elements = new Map<string, SVGElement>();
  _layers = new Map<LayerName, SVGGElement>();
  _selectionDOMs = new Map<string, Map<string, SVGElement>>();
  _defsNode!: SVGDefsElement;
  _cameraGroup!: SVGGElement;

  constructor(
    svgElement: SVGSVGElement,
    factory: NodeDOMFactory,
    camera: Camera,
  ) {
    this._svgRoot = svgElement;
    this._factory = factory;
    this._camera = camera;
    this._buildDOMSkeleton();
    this._elements.set(camera.id, this._cameraGroup);
    camera.groupId = this._cameraGroup.getAttribute('id') || '';
  }

  _buildDOMSkeleton(): void {
    this._svgRoot.innerHTML = '';

    this._defsNode = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'defs',
    );
    this._svgRoot.appendChild(this._defsNode);

    this._cameraGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    this._cameraGroup.setAttribute('id', 'cameraGroup');
    this._svgRoot.appendChild(this._cameraGroup);

    const ns = 'http://www.w3.org/2000/svg';
    const shapes = document.createElementNS(ns, 'g');
    const preview = document.createElementNS(ns, 'g');
    const groupSelection = document.createElementNS(ns, 'g');
    const selectionOverlay = document.createElementNS(ns, 'g');
    const overlay = document.createElementNS(ns, 'g');

    this._cameraGroup.appendChild(shapes);
    this._cameraGroup.appendChild(preview);
    this._cameraGroup.appendChild(groupSelection);
    this._cameraGroup.appendChild(selectionOverlay);
    this._svgRoot.appendChild(overlay);

    this._layers.set('shapesGroup', shapes);
    this._layers.set('previewGroup', preview);
    this._layers.set('groupSelectionOverlay', groupSelection);
    this._layers.set('selectionOverlay', selectionOverlay);
    this._layers.set('overlayRoot', overlay);
  }

  public initSystemNodes(systemNodes: Record<string, string>): void {
    for (const [sysId, id] of Object.entries(systemNodes)) {
      const tag = TAG_BY_SYS_ID[sysId] || 'rect';
      const el = this._factory.createDOM(tag);
      this._mountSystemNode(sysId, el);
      this._elements.set(id, el);
    }
  }

  _mountSystemNode(sysId: string, el: SVGElement): void {
    switch (sysId) {
      case 'artboard':
        this._cameraGroup.insertBefore(el, this._cameraGroup.firstChild);
        break;
      case 'grid':
        this._cameraGroup.insertBefore(
          el,
          this._cameraGroup.firstChild?.nextSibling ?? null,
        );
        break;
      case 'rulers':
        this._svgRoot.appendChild(el);
        break;
      case 'selection':
        this._svgRoot.lastElementChild?.appendChild(el);
        break;
      case 'selection-group':
        this._cameraGroup.querySelectorAll('g')[2]?.appendChild(el);
        break;
    }
  }

  public draw(payload: DrawPayload): void {
    const { id, type, layerName, ...diff } = payload;
    let element = this._elements.get(id);
    if (!element) {
      if (!layerName) return;
      const targetLayer = this._layers.get(layerName);
      if (!targetLayer) return;
      element = this._factory.createDOM(type);
      element.setAttribute('id', id);
      targetLayer.appendChild(element);
      this._elements.set(id, element);
    }
    if (SYSTEM_IDS.has(id)) {
      this._applySystemDiff(id, element, diff as Record<string, unknown>);
    } else {
      this._applyShapeDiff(element, diff as Record<string, unknown>);
    }
  }

  public drawSelectionBox(diff: Record<string, unknown>): string | null {
    const visible = diff.visible !== false;
    let domRef = (diff._domRef as string) || '';
    const layerName = (diff._layerName as string) || 'selectionOverlay';

    if (!visible && domRef) {
      const els = this._selectionDOMs.get(domRef);
      if (els) {
        els.get('g')?.remove();
        this._selectionDOMs.delete(domRef);
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
    const rect = els.get('rect')!;

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
        : parseFloat(rect.getAttribute('width') || '0');
    const h =
      typeof diff.height === 'number'
        ? diff.height
        : parseFloat(rect.getAttribute('height') || '0');

    const rcx = w / 2;
    const rcy = h / 2;
    g.setAttribute('transform', `translate(${x}, ${y}) rotate(${angle}, ${rcx}, ${rcy})`);
    g.setAttribute('data-x', String(x));
    g.setAttribute('data-y', String(y));
    g.setAttribute('data-angle', String(angle));
    g.setAttribute('visibility', 'visible');

    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));

    const hw = w / 2;
    const hh = h / 2;
    const offCorner = 7;
    const offEdge = 12;
    const cx = 12;
    const cy = 12;
    const handleData: Array<{
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
    for (const hd of handleData) {
      const handle = els.get(hd.key);
      if (handle) {
        handle.setAttribute(
          'transform',
          `translate(${hd.hx - cx}, ${hd.hy - cy}) rotate(${hd.rot}, ${cx}, ${cy})`,
        );
      }
    }

    return domRef;
  }

  _applySystemDiff(
    id: string,
    element: SVGElement,
    diff: Record<string, unknown>,
  ): void {
    switch (id) {
      case 'camera': {
        const x = typeof diff.x === 'number' ? diff.x : this._camera.x;
        const y = typeof diff.y === 'number' ? diff.y : this._camera.y;
        const zoom =
          typeof diff.zoom === 'number' ? diff.zoom : this._camera.zoom;
        const transform = `translate(${x}, ${y}) scale(${zoom})`;
        element.setAttribute('transform', transform);
        return;
      }
      case 'artboard': {
        element.setAttribute('x', '0');
        element.setAttribute('y', '0');
        element.setAttribute('pointer-events', 'none');
        const w =
          typeof diff.widthMM === 'number'
            ? diff.widthMM * 3.779527559055118
            : undefined;
        const h =
          typeof diff.heightMM === 'number'
            ? diff.heightMM * 3.779527559055118
            : undefined;
        const fill = typeof diff.fill === 'string' ? diff.fill : '#ffffff';
        if (w !== undefined) element.setAttribute('width', String(w));
        if (h !== undefined) element.setAttribute('height', String(h));
        element.setAttribute('fill', fill);
        return;
      }
      case 'grid':
      case 'rulers':
      case 'selection':
      case 'selection-group': {
        if ('visible' in diff) {
          element.setAttribute(
            'visibility',
            diff.visible ? 'visible' : 'hidden',
          );
        }
        return;
      }
    }
  }

  _applyShapeDiff(element: SVGElement, diff: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(diff)) {
      if (value === null || value === undefined) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  public remove(id: string): void {
    const element = this._elements.get(id);
    if (element) {
      element.remove();
      this._elements.delete(id);
    }
  }

  public get defs(): SVGDefsElement {
    return this._defsNode;
  }

  public get cameraGroup(): SVGGElement {
    return this._cameraGroup;
  }
}
