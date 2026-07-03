import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Camera } from '@/canvas/Camera';
import { SVG_NS } from '@/constants';

export class DebugOverlay {
  private readonly group: SVGGElement;
  private readonly camera: Camera;

  public constructor(camera: Camera) {
    this.camera = camera;
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('pointer-events', 'none');
  }

  public getElement(): SVGGElement {
    return this.group;
  }

  public update(elements: readonly AbstractGraphicElement[]): void {
    while (this.group.firstChild) {
      this.group.removeChild(this.group.firstChild);
    }

    const z = this.camera.zoom;

    for (const el of elements) {
      const pts = el.getWorldHitPoints();
      if (pts.length < 3) continue;

      const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');

      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', pointsStr);
      poly.setAttribute('fill', 'rgba(255, 0, 0, 0.15)');
      poly.setAttribute('stroke', 'rgba(255, 0, 0, 0.6)');
      poly.setAttribute('stroke-width', String(1 / z));
      poly.setAttribute(
        'stroke-dasharray',
        String(3 / z) + ' ' + String(2 / z),
      );
      this.group.appendChild(poly);
    }
  }

  public destroy(): void {
    this.group.remove();
  }
}
