import { NodeDOMFactory } from './NodeDOMFactory';
import { Camera } from './Camera';
import { DrawPayload, LayerName } from '@/types';
import { RulerBuilder } from '@/canvas/system/ruler/RulerBuilder';
import { FlexCutBuilder } from '@/canvas/system/FlexCutBuilder';
import { FlexTree, type CutSegment } from '@/math/flex-tree';

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
  _rulerBuilder: RulerBuilder;
  _flexCutBuilder = new FlexCutBuilder();
  _flexCutEls = new Map<
    string,
    { path: SVGPathElement; clipId: string; shapeEl: SVGElement }
  >();
  _flexCutDefs = new Map<string, SVGClipPathElement>();
  _flexTreeProvider: ((id: string) => FlexTree | null) | null = null;

  setFlexTreeProvider(fn: (id: string) => FlexTree | null): void {
    this._flexTreeProvider = fn;
  }

  constructor(
    svgElement: SVGSVGElement,
    factory: NodeDOMFactory,
    camera: Camera,
  ) {
    this._svgRoot = svgElement;
    this._factory = factory;
    this._camera = camera;
    this._rulerBuilder = new RulerBuilder(svgElement);
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
      this._syncFlexCut(id, type, element, diff as Record<string, unknown>);
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
      case 'rulers': {
        this._rulerBuilder.update(element as SVGGElement, {
          visible: typeof diff.visible === 'boolean' ? diff.visible : true,
          cameraX: typeof diff.cameraX === 'number' ? diff.cameraX : 0,
          cameraY: typeof diff.cameraY === 'number' ? diff.cameraY : 0,
          zoom: typeof diff.zoom === 'number' ? diff.zoom : 1,
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
    this._removeFlexCut(id);
  }

  private _removeFlexCut(id: string): void {
    const ce = this._flexCutEls.get(id);
    if (ce) {
      ce.path.remove();
      this._flexCutEls.delete(id);
    }
    const def = this._flexCutDefs.get(`flexcut-${id}`);
    if (def) {
      def.remove();
      this._flexCutDefs.delete(`flexcut-${id}`);
    }
  }

  private _syncFlexCut(
    id: string,
    type: string,
    shapeEl: SVGElement,
    diff: Record<string, unknown>,
  ): void {
    const hasFlexTree =
      typeof diff['flexTree.algorithm'] === 'string';
    const currentCut = this._flexCutEls.get(id);
    const wasActive = currentCut !== undefined;

    if (!hasFlexTree && !wasActive) return;

    if (!hasFlexTree && wasActive) {
      this._removeFlexCut(id);
      return;
    }

    if (!hasFlexTree) return;

    const config: Record<string, number | string> = {};
    for (const [key, val] of Object.entries(diff)) {
      if (key.startsWith('flexTree.')) {
        config[key.slice(9)] = val as number | string;
      }
    }

    let geomChanged = false;
    const geomKeys = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'd', 'transform'];
    for (const key of Object.keys(diff)) {
      if (geomKeys.includes(key)) { geomChanged = true; break; }
    }

    const configChanged = Object.keys(config).length > 0;
    if (!configChanged && !geomChanged && wasActive) return;

    const algo = config.algorithm as string ?? 'linear';
    const step = config.step !== undefined ? Number(config.step) : (this._flexTreeFor(id)?.step ?? 3.5);
    const link = config.link !== undefined ? Number(config.link) : (this._flexTreeFor(id)?.link ?? 3.0);
    const dash = config.dash !== undefined ? Number(config.dash) : (this._flexTreeFor(id)?.dash ?? 25.0);
    const amplitude = config.amplitude !== undefined ? Number(config.amplitude) : (this._flexTreeFor(id)?.amplitude ?? 1.0);

    let bboxX = parseFloat(
      shapeEl.getAttribute('x') ||
        shapeEl.getAttribute('cx') ||
        '0',
    );
    let bboxY = parseFloat(
      shapeEl.getAttribute('y') ||
        shapeEl.getAttribute('cy') ||
        '0',
    );
    let bboxW = parseFloat(shapeEl.getAttribute('width') || '0');
    let bboxH = parseFloat(shapeEl.getAttribute('height') || '0');

    if (type === 'circle') {
      const r = parseFloat(shapeEl.getAttribute('r') || '0');
      bboxW = r * 2;
      bboxH = r * 2;
      bboxX = bboxX - r;
      bboxY = bboxY - r;
    } else if (type === 'ellipse') {
      const rx = parseFloat(shapeEl.getAttribute('rx') || '0');
      const ry = parseFloat(shapeEl.getAttribute('ry') || '0');
      bboxW = rx * 2;
      bboxH = ry * 2;
      bboxX = bboxX - rx;
      bboxY = bboxY - ry;
    }

    // Извлечь масштаб из матрицы: узор генерируется в масштабированном
    // размере (мм сохраняются), а из трансформа оверлея scale убирается.
    const transformStr = shapeEl.getAttribute('transform');
    let m = new DOMMatrix();
    if (transformStr) {
      try {
        m = new DOMMatrix(transformStr);
      } catch {
        m = new DOMMatrix();
      }
    }
    const sx = Math.hypot(m.a, m.b) || 1;
    const sy = Math.hypot(m.c, m.d) || 1;

    const bbox = {
      x: bboxX * sx,
      y: bboxY * sy,
      width: bboxW * sx,
      height: bboxH * sy,
    };

    const clone = new FlexTree();
    clone.algorithm = algo as never;
    clone.step = step;
    clone.link = link;
    clone.dash = dash;
    clone.amplitude = amplitude;

    const segments: CutSegment[] = clone.generateCutData(bbox);
    const pathD = this._flexCutBuilder.buildPathD(segments);

    // Матрица оверлея без scale: M * scale(1/sx, 1/sy)
    const descaledTransform = `matrix(${m.a / sx},${m.b / sx},${m.c / sy},${m.d / sy},${m.e},${m.f})`;

    const clipId = `flexcut-${id}`;
    const existingDef = this._flexCutDefs.get(clipId);
    if (existingDef && (configChanged || geomChanged)) {
      existingDef.remove();
      this._flexCutDefs.delete(clipId);
    }

    if (!this._flexCutDefs.has(clipId)) {
      const geom: Record<string, unknown> = {};
      for (const k of geomKeys) {
        const v = shapeEl.getAttribute(k);
        if (v !== null) geom[k] = v;
      }
      const cp = this._flexCutBuilder.buildClipDef(id, type, geom, sx, sy);
      this._defsNode.appendChild(cp);
      this._flexCutDefs.set(clipId, cp);
    }

    if (currentCut) {
      currentCut.path.setAttribute('d', pathD);
      currentCut.path.setAttribute('transform', descaledTransform);
    } else {
      const path = this._flexCutBuilder.createCutPath(pathD, clipId);
      path.setAttribute('transform', descaledTransform);
      if (shapeEl.parentNode) {
        shapeEl.parentNode.insertBefore(path, shapeEl.nextSibling);
      }
      this._flexCutEls.set(id, { path, clipId, shapeEl });
    }
  }

  private _flexTreeFor(id: string): FlexTree | null {
    return this._flexTreeProvider?.(id) ?? null;
  }

  public get defs(): SVGDefsElement {
    return this._defsNode;
  }

  public get cameraGroup(): SVGGElement {
    return this._cameraGroup;
  }
}
