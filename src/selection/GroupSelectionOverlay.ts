import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { Group } from '@/group/Group';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { GroupSelectionRect } from './GroupSelectionRect';
import { setGroupRectQueue } from '@/utils/group-rect-queue';
import { RenderQueue } from '@/renderer/RenderQueue';
import { computeGroupBBox } from '@/utils/group-bbox-utils';

export class GroupSelectionOverlay {
  private readonly group: SVGGElement;
  private readonly camera: Camera;
  private rects = new Map<string, GroupSelectionRect>();

  public constructor(camera: Camera, queue: RenderQueue) {
    this.camera = camera;
    setGroupRectQueue(queue);
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('pointer-events', 'none');
  }

  private strokeWidth(z: number): string {
    return String(1.5 / z);
  }

  private dashArray(z: number): string {
    return String(6 / z) + ' ' + String(3 / z);
  }

  public sync(
    groups: Group[],
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    const z = this.camera.zoom;
    const pad = 2 / z;
    const needed = new Set(groups.map((g) => g.id));

    // remove stale rects
    for (const [id, rect] of this.rects) {
      if (!needed.has(id)) {
        rect.destroy();
        this.rects.delete(id);
      }
    }

    // add / update rects
    for (const g of groups) {
      const bbox = computeGroupBBox(g, findElement, z);
      if (!bbox) continue;

      let rect = this.rects.get(g.id);
      if (!rect) {
        rect = new GroupSelectionRect();
        rect.element.setAttribute('stroke-width', this.strokeWidth(z));
        rect.element.setAttribute('stroke-dasharray', this.dashArray(z));
        this.group.appendChild(rect.toDOM());
        this.rects.set(g.id, rect);
      }

      rect.element.setAttribute('x', String(bbox.x - pad));
      rect.element.setAttribute('y', String(bbox.y - pad));
      rect.element.setAttribute('width', String(bbox.width + pad * 2));
      rect.element.setAttribute('height', String(bbox.height + pad * 2));
    }
  }

  public translateRect(groupId: string, dx: number, dy: number): void {
    const rect = this.rects.get(groupId);
    if (rect) rect.applyDelta(dx, dy);
  }

  public clear(): void {
    for (const rect of this.rects.values()) {
      rect.destroy();
    }
    this.rects.clear();
  }

  public getElement(): SVGGElement {
    return this.group;
  }

  public getRect(id: string): GroupSelectionRect | undefined {
    return this.rects.get(id);
  }

  public destroy(): void {
    this.clear();
    this.group.remove();
  }
}
