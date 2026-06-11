import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { Group } from '@/group/Group';
import type { SvgElement } from '@/shapes/elements/SvgElement';

export class GroupSelectionOverlay {
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

  public update(groups: Group[], findElement: (id: string) => SvgElement | undefined): void {
    while (this.group.firstChild) {
      this.group.removeChild(this.group.firstChild);
    }

    if (groups.length === 0) return;

    const z = this.camera.zoom;

    for (const g of groups) {
      const bbox = this.computeGroupBBox(g, findElement);
      if (!bbox) continue;

      const pad = 2 / z;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(bbox.x - pad));
      rect.setAttribute('y', String(bbox.y - pad));
      rect.setAttribute('width', String(bbox.width + pad * 2));
      rect.setAttribute('height', String(bbox.height + pad * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#4285f4');
      rect.setAttribute('stroke-width', String(1.5 / z));
      rect.setAttribute('stroke-dasharray', String(6 / z) + ' ' + String(3 / z));
      this.group.appendChild(rect);
    }
  }

  private computeGroupBBox(
    g: Group,
    findElement: (id: string) => SvgElement | undefined,
  ): { x: number; y: number; width: number; height: number } | null {
    if (g.elementIds.size === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasAny = false;

    for (const elId of g.elementIds) {
      const el = findElement(elId);
      if (!el) continue;
      const bbox = el.getTransformedBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;
      hasAny = true;
      if (bbox.x < minX) minX = bbox.x;
      if (bbox.y < minY) minY = bbox.y;
      if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
      if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
    }

    if (!hasAny) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  public destroy(): void {
    this.group.remove();
  }
}
