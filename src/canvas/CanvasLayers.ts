import type { LayerName } from '@/core/type';

export class CanvasLayers {
  readonly _svgRoot: SVGSVGElement;
  _defsNode!: SVGDefsElement;
  _cameraGroup!: SVGGElement;
  _layers = new Map<LayerName, SVGGElement>();

  constructor(svgRoot: SVGSVGElement) {
    this._svgRoot = svgRoot;
    this._buildDOMSkeleton();
  }

  private _buildDOMSkeleton(): void {
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
    const nodeEditOverlay = document.createElementNS(ns, 'g');
    const overlay = document.createElementNS(ns, 'g');

    this._cameraGroup.appendChild(shapes);
    this._cameraGroup.appendChild(preview);
    this._cameraGroup.appendChild(groupSelection);
    this._cameraGroup.appendChild(selectionOverlay);
    this._cameraGroup.appendChild(nodeEditOverlay);
    this._svgRoot.appendChild(overlay);

    this._layers.set('shapesGroup', shapes);
    this._layers.set('previewGroup', preview);
    this._layers.set('groupSelectionOverlay', groupSelection);
    this._layers.set('selectionOverlay', selectionOverlay);
    this._layers.set('nodeEditOverlay', nodeEditOverlay);
    this._layers.set('overlayRoot', overlay);
  }
}
