import { NodeDOMFactory } from './NodeDOMFactory';
import { Camera } from './Camera';
import { CanvasLayers } from './CanvasLayers';
import { CanvasSystemNodes } from './CanvasSystemNodes';
import { CanvasFlexCut } from './CanvasFlexCut';
import { CanvasTextRenderer } from './CanvasTextRenderer';
import { CanvasSelectionBox } from './CanvasSelectionBox';
import { CanvasLaserStyle } from './CanvasLaserStyle';
import { CanvasClipPath } from './CanvasClipPath';
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
  readonly _selectionBox: CanvasSelectionBox;
  readonly _laserStyle: CanvasLaserStyle;
  readonly _clipPath: CanvasClipPath;
  _elements = new Map<string, SVGElement>();

  setFlexTreeProvider(fn: (id: string) => FlexTree | null): void {
    this._flexCut.setFlexTreeProvider(fn);
  }

  setLaserStyleProvider(fn: (id: string) => LaserStyleOverride | null): void {
    this._laserStyle.setLaserStyleProvider(fn);
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
    this._selectionBox = new CanvasSelectionBox(factory, canvasLayers._layers);
    this._laserStyle = new CanvasLaserStyle(this._elements);
    this._clipPath = new CanvasClipPath(this._elements, canvasLayers._defsNode);

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
      this._applyShapeDiff(element, diff as Record<string, unknown>);
      this._flexCut.sync(id, type, element, diff as Record<string, unknown>);
      this._clipPath.sync(id, diff as Record<string, unknown>);
      this._refreshMaskedImages(id);
      if (type === 'image' && this._clipPath.hasClipPath(id)) {
        this._clipPath.refreshImage(id);
      }
      this._laserStyle.captureBase(id, diff as Record<string, unknown>);
      this._laserStyle.applyLaser(id, element);
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
    this._textRenderer._textDivs.delete(id);
    this._flexCut.remove(id);
    this._clipPath.remove(id);
  }

  public refreshLaserStyles(ids?: string[]): void {
    this._laserStyle.refresh(ids);
  }

  public getTextForeignObject(id: string): SVGElement | undefined {
    return this._textRenderer.getForeignObject(id);
  }

  public getTextDiv(id: string): HTMLDivElement | undefined {
    return this._textRenderer.getDiv(id);
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
