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
    const overlay = document.createElementNS(ns, 'g');

    this._cameraGroup.appendChild(shapes);
    this._cameraGroup.appendChild(preview);
    this._cameraGroup.appendChild(groupSelection);
    this._svgRoot.appendChild(overlay);

    this._layers.set('shapesGroup', shapes);
    this._layers.set('previewGroup', preview);
    this._layers.set('groupSelectionOverlay', groupSelection);
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
