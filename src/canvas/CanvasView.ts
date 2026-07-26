import { NodeDOMFactory } from './NodeDOMFactory';
import { Camera } from './Camera';
import { CanvasLayers } from './CanvasLayers';
import { CanvasSystemNodes } from './CanvasSystemNodes';
import { CanvasFlexCut } from './CanvasFlexCut';
import { CanvasTextRenderer } from './CanvasTextRenderer';
import { CanvasNodeEditRenderer } from './CanvasNodeEditRenderer';
import { CanvasSelectionBox } from './CanvasSelectionBox';
import { CanvasLaserStyle } from './CanvasLaserStyle';
import { CanvasClipPath } from './CanvasClipPath';
import { CanvasElementIndex } from './CanvasElementIndex';
import { DrawPayload, LayerName } from '@/core/type';
import { RulerBuilder } from '@/modules/ruler/RulerBuilder';
import { FlexTree } from '@/core/math/flex-tree';
import type { LaserStyleOverride } from '@/modules/laser/laser-types';

export class CanvasView {
  readonly _svgRoot: SVGSVGElement;
  readonly _factory: NodeDOMFactory;
  readonly _camera: Camera;
  readonly _canvasLayers: CanvasLayers;
  readonly _systemNodes: CanvasSystemNodes;
  readonly _flexCut: CanvasFlexCut;
  readonly _textRenderer: CanvasTextRenderer;
  readonly _nodeEditRenderer: CanvasNodeEditRenderer;
  readonly _selectionBox: CanvasSelectionBox;
  readonly _laserStyle: CanvasLaserStyle;
  readonly _clipPath: CanvasClipPath;
  readonly _elementIndex: CanvasElementIndex;
  _elements = new Map<string, SVGElement>();
  _onImageMoved:
    | ((imageId: string, oldMatrix: DOMMatrix, newMatrix: DOMMatrix) => void)
    | null = null;
  _onElementRedrawn: ((elementId: string) => void) | null = null;

  setFlexTreeProvider(fn: (id: string) => FlexTree | null): void {
    this._flexCut.setFlexTreeProvider(fn);
  }

  setLaserStyleProvider(fn: (id: string) => LaserStyleOverride | null): void {
    this._laserStyle.setLaserStyleProvider(fn);
  }

  private _modeStyleProvider:
    | ((id: string) => LaserStyleOverride | null)
    | null = null;

  setModeStyleProvider(
    fn: ((id: string) => LaserStyleOverride | null) | null,
  ): void {
    this._modeStyleProvider = fn;
  }

  constructor(
    svgElement: SVGSVGElement,
    factory: NodeDOMFactory,
    camera: Camera,
    canvasLayers: CanvasLayers,
  ) {
    this._svgRoot = svgElement;
    this._factory = factory;
    this._camera = camera;
    this._canvasLayers = canvasLayers;

    const rulerBuilder = new RulerBuilder(svgElement);
    this._systemNodes = new CanvasSystemNodes(
      svgElement,
      canvasLayers._cameraGroup,
      factory,
      camera,
      rulerBuilder,
      this._elements,
    );

    this._flexCut = new CanvasFlexCut(this._elements, canvasLayers._defsNode);
    this._textRenderer = new CanvasTextRenderer(
      this._elements,
      canvasLayers._layers,
    );
    this._nodeEditRenderer = new CanvasNodeEditRenderer(
      this._elements,
      canvasLayers._layers,
    );
    this._selectionBox = new CanvasSelectionBox(factory, canvasLayers._layers);
    this._laserStyle = new CanvasLaserStyle(this._elements);
    this._clipPath = new CanvasClipPath(this._elements, canvasLayers._defsNode);
    this._elementIndex = new CanvasElementIndex(this._elements);

    this._elements.set(camera.id, this._canvasLayers._cameraGroup);
    camera.groupId = this._canvasLayers._cameraGroup.getAttribute('id') || '';
  }

  public initSystemNodes(systemNodes: Record<string, string>): void {
    this._systemNodes.init(systemNodes);
  }

  public draw(payload: DrawPayload): void {
    const { id, type, layerName, ...diff } = payload;
    if (type === 'text' && !CanvasSystemNodes.isSystem(id)) {
      this._textRenderer.sync(id, layerName, diff as Record<string, unknown>);
      return;
    }
    if (type === 'overlay') {
      this._nodeEditRenderer.sync(
        id,
        layerName,
        diff as Record<string, unknown>,
      );
      return;
    }
    if (type === 'path' && !CanvasSystemNodes.isSystem(id)) {
      // path rendering is handled by NodeDOMFactory via _applyShapeDiff (d attribute)
    }
    let element = this._elements.get(id);
    if (!element) {
      if (!layerName) return;
      const targetLayer = this._canvasLayers._layers.get(layerName);
      if (!targetLayer) return;
      element = this._factory.createDOM(type);
      element.setAttribute('id', id);
      targetLayer.appendChild(element);
      this._elements.set(id, element);
    }
    if (CanvasSystemNodes.isSystem(id)) {
      this._systemNodes.applyDiff(id, element, diff as Record<string, unknown>);
    } else {
      const syncMasks =
        type === 'image' &&
        this._clipPath.hasClipPath(id) &&
        this._onImageMoved;
      let oldM: DOMMatrix | null = null;

      if (syncMasks) {
        const ox = parseFloat(element.getAttribute('x') || '0');
        const oy = parseFloat(element.getAttribute('y') || '0');
        const ot = element.getAttribute('transform') || '';
        oldM = new DOMMatrix(ot).translateSelf(ox, oy);
      }

      this._applyShapeDiff(element, diff as Record<string, unknown>);

      if (syncMasks && oldM) {
        const nx = parseFloat(element.getAttribute('x') || '0');
        const ny = parseFloat(element.getAttribute('y') || '0');
        const nt = element.getAttribute('transform') || '';
        const newM = new DOMMatrix(nt).translateSelf(nx, ny);

        if (
          newM.a !== oldM.a ||
          newM.b !== oldM.b ||
          newM.c !== oldM.c ||
          newM.d !== oldM.d ||
          newM.e !== oldM.e ||
          newM.f !== oldM.f
        ) {
          this._onImageMoved!(id, oldM, newM);
        }
      }

      this._flexCut.sync(id, type, element, diff as Record<string, unknown>);
      this._clipPath.sync(id, diff as Record<string, unknown>);
      this._refreshMaskedImages(id);
      if (type === 'image' && this._clipPath.hasClipPath(id)) {
        this._clipPath.refreshImage(id);
      }
      this._laserStyle.captureBase(id, diff as Record<string, unknown>);
      this._laserStyle.applyLaser(id, element);
      this._applyModeStyle(id, element);
    }
  }

  _applyShapeDiff(element: SVGElement, diff: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(diff)) {
      if (key === 'maskElementIds') continue;
      if (value === null || value === undefined) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  /** Перестраивает clip-path картинок, замаскированных элементом elementId. */
  private _refreshMaskedImages(elementId: string): void {
    const imageIds = this._clipPath.getMaskedImageIds(elementId);
    for (const imageId of imageIds) {
      this._clipPath.refreshImage(imageId);
      this._onElementRedrawn?.(imageId);
    }
  }

  public setLayerVisibility(layerName: string, visible: boolean): void {
    const layer = this._canvasLayers._layers.get(layerName as LayerName);
    if (layer) {
      layer.style.display = visible ? '' : 'none';
    }
  }

  public remove(id: string): void {
    const element = this._elements.get(id);
    if (element) {
      element.remove();
      this._elements.delete(id);
    }
    this._laserStyle._baseStyle.delete(id);
    this._textRenderer._textEls.delete(id);
    this._flexCut.remove(id);
    this._clipPath.remove(id);
  }

  public refreshLaserStyles(ids?: string[]): void {
    this._laserStyle.refresh(ids);
    if (this._modeStyleProvider) {
      const targets = ids ?? Array.from(this._elements.keys());
      for (const id of targets) {
        const el = this._elements.get(id);
        if (el) this._applyModeStyle(id, el);
      }
    }
  }

  private _applyModeStyle(id: string, element: SVGElement): void {
    if (CanvasSystemNodes.isSystem(id)) return;
    const o = this._modeStyleProvider?.(id);
    if (!o) return;
    if (o.fill !== undefined) element.setAttribute('fill', o.fill);
    if (o.stroke !== undefined) element.setAttribute('stroke', o.stroke);
    if (o.strokeWidth !== undefined)
      element.setAttribute('stroke-width', String(o.strokeWidth));
    if (o.visibility !== undefined)
      element.setAttribute('visibility', o.visibility);
    if (o.opacity !== undefined)
      element.setAttribute('opacity', String(o.opacity));
  }

  public getTextSvgElement(id: string): SVGElement | undefined {
    return this._textRenderer.getTextElement(id);
  }

  public measureTextBBox(
    id: string,
  ): { x: number; y: number; width: number; height: number } | null {
    return this._textRenderer.measureBBox(id);
  }

  public drawSelectionBox(diff: Record<string, unknown>): string | null {
    return this._selectionBox.draw(diff);
  }

  public get defs(): SVGDefsElement {
    return this._canvasLayers._defsNode;
  }

  public get cameraGroup(): SVGGElement {
    return this._canvasLayers._cameraGroup;
  }
}
