import { FlexCutBuilder } from '@/canvas/nodes/FlexCutBuilder';
import { FlexTree, type CutSegment } from '@/core/math/flex-tree';

export class CanvasFlexCut {
  _flexCutBuilder = new FlexCutBuilder();
  _flexCutEls = new Map<
    string,
    { path: SVGPathElement; clipId: string; shapeEl: SVGElement }
  >();
  _flexCutDefs = new Map<string, SVGClipPathElement>();
  _flexTreeProvider: ((id: string) => FlexTree | null) | null = null;

  readonly _elements: Map<string, SVGElement>;
  readonly _defsNode: SVGDefsElement;

  constructor(elements: Map<string, SVGElement>, defsNode: SVGDefsElement) {
    this._elements = elements;
    this._defsNode = defsNode;
  }

  setFlexTreeProvider(fn: (id: string) => FlexTree | null): void {
    this._flexTreeProvider = fn;
  }

  remove(id: string): void {
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

  sync(
    id: string,
    type: string,
    shapeEl: SVGElement,
    diff: Record<string, unknown>,
  ): void {
    const hasFlexTree = typeof diff['flexTree.algorithm'] === 'string';
    const currentCut = this._flexCutEls.get(id);
    const wasActive = currentCut !== undefined;

    if (!hasFlexTree && !wasActive) return;

    if (!hasFlexTree && wasActive) {
      this.remove(id);
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
    const geomKeys = [
      'x',
      'y',
      'width',
      'height',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'points',
      'd',
      'transform',
    ];
    for (const key of Object.keys(diff)) {
      if (geomKeys.includes(key)) {
        geomChanged = true;
        break;
      }
    }

    const configChanged = Object.keys(config).length > 0;
    if (!configChanged && !geomChanged && wasActive) return;

    const algo = (config.algorithm as string) ?? 'linear';
    const step =
      config.step !== undefined
        ? Number(config.step)
        : (this._flexTreeFor(id)?.step ?? 3.5);
    const link =
      config.link !== undefined
        ? Number(config.link)
        : (this._flexTreeFor(id)?.link ?? 3.0);
    const dash =
      config.dash !== undefined
        ? Number(config.dash)
        : (this._flexTreeFor(id)?.dash ?? 25.0);
    const amplitude =
      config.amplitude !== undefined
        ? Number(config.amplitude)
        : (this._flexTreeFor(id)?.amplitude ?? 1.0);

    let bboxX = parseFloat(
      shapeEl.getAttribute('x') || shapeEl.getAttribute('cx') || '0',
    );
    let bboxY = parseFloat(
      shapeEl.getAttribute('y') || shapeEl.getAttribute('cy') || '0',
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

  _flexTreeFor(id: string): FlexTree | null {
    return this._flexTreeProvider?.(id) ?? null;
  }
}
