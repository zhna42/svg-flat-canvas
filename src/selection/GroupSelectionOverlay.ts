import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { Group } from '@/group/Group';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { computeGroupWorldBBox } from '@/utils/group-bbox-utils';

export class GroupSelectionOverlay {
  private readonly group: SVGGElement;
  private readonly camera: Camera;
  private rects = new Map<string, SVGRectElement>();

  public constructor(camera: Camera) {
    this.camera = camera;
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('pointer-events', 'none');
  }

  public sync(
    groups: Group[],
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    const needed = new Set(groups.map((g) => g.id));

    for (const [id, rect] of this.rects) {
      if (!needed.has(id)) {
        rect.remove();
        this.rects.delete(id);
      }
    }

    for (const g of groups) {
      const worldBBox = computeGroupWorldBBox(
        g,
        findElement,
      );
      if (!worldBBox) continue;

      const screenBBox = this.camera.worldRectToScreen(worldBBox);

      let rect = this.rects.get(g.id);
      if (!rect) {
        rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#4285f4');
        rect.setAttribute('stroke-width', '1.5');
        rect.setAttribute('stroke-dasharray', '6 3');
        rect.setAttribute('pointer-events', 'none');
        this.group.appendChild(rect);
        this.rects.set(g.id, rect);
      }

      rect.setAttribute('x', String(screenBBox.x - 2));
      rect.setAttribute('y', String(screenBBox.y - 2));
      rect.setAttribute('width', String(screenBBox.width + 4));
      rect.setAttribute('height', String(screenBBox.height + 4));
    }
  }

  public clear(): void {
    for (const rect of this.rects.values()) {
      rect.remove();
    }
    this.rects.clear();
  }

  public getElement(): SVGGElement {
    return this.group;
  }

  public destroy(): void {
    this.clear();
    this.group.remove();
  }
}
