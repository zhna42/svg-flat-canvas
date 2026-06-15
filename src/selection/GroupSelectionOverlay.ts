import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { Group } from '@/group/Group';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import { GroupSelectionRect, setGroupRectQueue } from './GroupSelectionRect';
import { RenderQueue } from '@/renderer/RenderQueue';

function computeGroupBBox(
  g: Group,
  findElement: (id: string) => SvgElement | undefined,
  _z: number,
): { x: number; y: number; width: number; height: number } | null {
  if (g.elementIds.size === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
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
    findElement: (id: string) => SvgElement | undefined,
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
