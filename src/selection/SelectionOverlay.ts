import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { Camera } from '@/camera/Camera';
import { SVG_NS } from '@/constants';

export class SelectionOverlay {
  private readonly group: SVGGElement;
  private readonly camera: Camera;

  public constructor(camera: Camera) {
    this.camera = camera;
    this.group = document.createElementNS(SVG_NS, 'g');
  }

  public getElement(): SVGGElement {
    return this.group;
  }

  public update(elements: readonly SvgElement[]): void {
    while (this.group.firstChild) {
      this.group.removeChild(this.group.firstChild);
    }

    const pad = 2 / this.camera.zoom;

    for (const el of elements) {
      const bbox = el.getTransformedBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(bbox.x - pad));
      rect.setAttribute('y', String(bbox.y - pad));
      rect.setAttribute('width', String(bbox.width + pad * 2));
      rect.setAttribute('height', String(bbox.height + pad * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#4285f4');
      rect.setAttribute('stroke-width', String(4 / this.camera.zoom));
      rect.setAttribute('stroke-dasharray', String(4 / this.camera.zoom) + ' ' + String(2 / this.camera.zoom));
      rect.setAttribute('pointer-events', 'none');
      this.group.appendChild(rect);
    }
  }

  public destroy(): void {
    this.group.remove();
  }
}
