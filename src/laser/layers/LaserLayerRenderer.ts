import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/canvas/Camera';
import type { LaserLayerGroupInfo } from './types';
import { aggregateElements, computeLayerGrading } from './LaserLayerGrading';
import { MM_TO_PX } from '@/constants';

const CUT_STROKE_WIDTH_MM = 0.2;
const NS = 'http://www.w3.org/2000/svg';

export class LaserLayerRenderer {
  private svgRoot: SVGSVGElement | null = null;
  private cameraGroup: SVGGElement | null = null;
  private useGroup: SVGGElement | null = null;
  private defsGroup: SVGDefsElement | null = null;
  private visible = false;

  public init(svg: SVGSVGElement, _camera: Camera): void {
    this.svgRoot = svg;
    this.cameraGroup =
      svg.querySelector('#cameraGroup') as SVGGElement | null;

    if (this.cameraGroup) {
      let g = svg.querySelector('#laser-use-group') as SVGGElement | null;
      if (!g) {
        g = document.createElementNS(NS, 'g');
        g.setAttribute('id', 'laser-use-group');
        g.style.display = 'none';
        this.cameraGroup.appendChild(g);
      }
      this.useGroup = g;
    }
  }

  public build(
    elements: AbstractGraphicElement[],
    layerInfos: Array<{
      layerId: string;
      groups: LaserLayerGroupInfo[];
    }>,
    orphanGroups: LaserLayerGroupInfo[],
    orphanVisible: boolean,
  ): void {
    if (!this.svgRoot || !this.useGroup) return;

    this.clearInternal();

    this.defsGroup = document.createElementNS(NS, 'defs');
    this.defsGroup.setAttribute('id', 'laser-layer-defs');
    this.svgRoot.insertBefore(this.defsGroup, this.svgRoot.firstChild);

    for (const el of elements) {
      const defEl = this.createElementDef(el);
      this.defsGroup.appendChild(defEl);
    }

    const filteredLayerInfos = orphanVisible
      ? layerInfos
      : layerInfos;
    const orphanInfos = orphanVisible ? orphanGroups : [];

    const aggregated = aggregateElements(filteredLayerInfos, orphanInfos);
    const grading = computeLayerGrading(aggregated);
    const gradingMap = new Map(grading.map((g) => [g.elementId, g]));

    const cutStrokeWidth = String(CUT_STROKE_WIDTH_MM * MM_TO_PX);

    for (const el of elements) {
      const gResult = gradingMap.get(el.id);
      if (!gResult) continue;

      const useEl = document.createElementNS(NS, 'use');
      useEl.setAttribute('href', `#laser-def-${el.id}`);
      useEl.setAttribute('opacity', String(Math.round(gResult.opacity * 1000) / 1000));

      if (gResult.hasCut) {
        useEl.setAttribute('stroke', '#ff0000');
        useEl.setAttribute('stroke-width', cutStrokeWidth);
        useEl.setAttribute('fill', gResult.color !== 'none' ? gResult.color : 'none');
      } else if (gResult.color !== 'none') {
        useEl.setAttribute('fill', gResult.color);
        useEl.setAttribute('stroke', 'none');
      } else {
        useEl.setAttribute('fill', '#ffffff');
        useEl.setAttribute('stroke', 'none');
        useEl.setAttribute('opacity', '0.1');
      }

      this.useGroup.appendChild(useEl);
    }

    this.useGroup.style.display = '';
    this.visible = true;
  }

  private createElementDef(el: AbstractGraphicElement): SVGElement {
    const type = el.type === 'use' ? 'g' : el.type;
    const defEl = document.createElementNS(NS, type);
    defEl.setAttribute('id', `laser-def-${el.id}`);

    const geomProps = el.getRenderGeometry() as Record<string, unknown>;
    for (const [key, value] of Object.entries(geomProps)) {
      if (
        value !== undefined &&
        value !== null &&
        key !== 'href' &&
        key !== 'fill' &&
        key !== 'stroke' &&
        key !== 'stroke-width' &&
        key !== 'opacity'
      ) {
        defEl.setAttribute(key, String(value));
      }
    }

    const dto = el.toDTO();
    const attrs = (dto.attributes ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(attrs)) {
      if (
        key !== 'fill' &&
        key !== 'stroke' &&
        key !== 'stroke-width' &&
        key !== 'opacity' &&
        key !== 'visibility'
      ) {
        if (value !== undefined && value !== null) {
          defEl.setAttribute(key, String(value));
        }
      }
    }

    const matrix = el.transform.matrix;
    const isIdentity =
      matrix.a === 1 &&
      matrix.b === 0 &&
      matrix.c === 0 &&
      matrix.d === 1 &&
      matrix.e === 0 &&
      matrix.f === 0;
    if (!isIdentity) {
      defEl.setAttribute(
        'transform',
        `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e},${matrix.f})`,
      );
    }

    return defEl;
  }

  public show(): void {
    if (this.useGroup) this.useGroup.style.display = '';
    this.visible = true;
  }

  public hide(): void {
    if (this.useGroup) this.useGroup.style.display = 'none';
    this.visible = false;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public clear(): void {
    this.clearInternal();
    this.hide();
  }

  private clearInternal(): void {
    if (this.defsGroup) {
      this.defsGroup.remove();
      this.defsGroup = null;
    }
    if (this.useGroup) {
      while (this.useGroup.firstChild) {
        this.useGroup.firstChild.remove();
      }
    }
  }

  public destroy(): void {
    this.clearInternal();
    if (this.useGroup) {
      this.useGroup.remove();
      this.useGroup = null;
    }
    this.svgRoot = null;
    this.cameraGroup = null;
  }
}
