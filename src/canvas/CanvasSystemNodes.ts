import type { NodeDOMFactory } from './NodeDOMFactory';
import type { Camera } from './Camera';
import type { RulerBuilder } from '@/modules/ruler/RulerBuilder';
import { MM_TO_PX } from '@/constants';

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

export class CanvasSystemNodes {
  readonly _svgRoot: SVGSVGElement;
  readonly _cameraGroup: SVGGElement;
  readonly _factory: NodeDOMFactory;
  readonly _camera: Camera;
  readonly _rulerBuilder: RulerBuilder;
  readonly _elements: Map<string, SVGElement>;

  constructor(
    svgRoot: SVGSVGElement,
    cameraGroup: SVGGElement,
    factory: NodeDOMFactory,
    camera: Camera,
    rulerBuilder: RulerBuilder,
    elements: Map<string, SVGElement>,
  ) {
    this._svgRoot = svgRoot;
    this._cameraGroup = cameraGroup;
    this._factory = factory;
    this._camera = camera;
    this._rulerBuilder = rulerBuilder;
    this._elements = elements;
  }

  static isSystem(id: string): boolean {
    return SYSTEM_IDS.has(id);
  }

  init(systemNodes: Record<string, string>): void {
    for (const [sysId, id] of Object.entries(systemNodes)) {
      const tag = TAG_BY_SYS_ID[sysId] || 'rect';
      const el = this._factory.createDOM(tag);
      this._mountNode(sysId, el);
      this._elements.set(id, el);
    }
  }

  applyDiff(
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
            ? diff.widthMM * MM_TO_PX
            : undefined;
        const h =
          typeof diff.heightMM === 'number'
            ? diff.heightMM * MM_TO_PX
            : undefined;
        const fill = typeof diff.fill === 'string' ? diff.fill : '#ffffff';
        if (w !== undefined) element.setAttribute('width', String(w));
        if (h !== undefined) element.setAttribute('height', String(h));
        element.setAttribute('fill', fill);
        return;
      }
      case 'rulers': {
        this._rulerBuilder.update(element as SVGGElement, {
          visible: typeof diff.visible === 'boolean' ? diff.visible : true,
          cameraX: typeof diff.cameraX === 'number' ? diff.cameraX : 0,
          cameraY: typeof diff.cameraY === 'number' ? diff.cameraY : 0,
          zoom: typeof diff.zoom === 'number' ? diff.zoom : 1,
          flipY: typeof diff.flipY === 'boolean' ? diff.flipY : false,
          worldHeightPx:
            typeof diff.worldHeightPx === 'number' ? diff.worldHeightPx : 0,
        });
        return;
      }
      case 'grid':
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

  _mountNode(sysId: string, el: SVGElement): void {
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
}
