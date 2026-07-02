import { SVG_NS } from '@/constants';
import type { Group } from '@/group/Group';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { computeGroupWorldBBox } from '@/spatial/group-bbox-utils';

export type GroupHandlePosition =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

const HANDLE_SIZE = 8;
const HANDLE_OFFSET = HANDLE_SIZE / 2;
const HANDLE_FILL = '#fff';
const HANDLE_STROKE = '#4285f4';

const handleLocalPositions = (
  w: number,
  h: number,
): { pos: GroupHandlePosition; cx: number; cy: number }[] => [
  { pos: 'nw', cx: 0, cy: 0 },
  { pos: 'n', cx: w / 2, cy: 0 },
  { pos: 'ne', cx: w, cy: 0 },
  { pos: 'e', cx: w, cy: h / 2 },
  { pos: 'se', cx: w, cy: h },
  { pos: 's', cx: w / 2, cy: h },
  { pos: 'sw', cx: 0, cy: h },
  { pos: 'w', cx: 0, cy: h / 2 },
];

interface GroupOverlayData {
  group: SVGGElement;
  rect: SVGRectElement;
  handleGroup: SVGGElement;
  bbox: { x: number; y: number; width: number; height: number };
}

export class GroupSelectionOverlay {
  private readonly root: SVGGElement;
  private overlays = new Map<string, GroupOverlayData>();

  public constructor() {
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('pointer-events', 'none');
  }

  public sync(
    groups: Group[],
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    const needed = new Set(groups.map((g) => g.id));

    for (const [id, data] of this.overlays) {
      if (!needed.has(id)) {
        data.group.remove();
        this.overlays.delete(id);
      }
    }

    for (const g of groups) {
      const worldBBox = computeGroupWorldBBox(g, findElement);
      if (!worldBBox) continue;

      let overlay = this.overlays.get(g.id);
      if (!overlay) {
        const group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('pointer-events', 'none');

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', HANDLE_STROKE);
        rect.setAttribute('stroke-width', String(1.5));
        rect.setAttribute('stroke-dasharray', '6 3');
        rect.setAttribute('pointer-events', 'none');
        group.appendChild(rect);

        const handleGroup = document.createElementNS(SVG_NS, 'g');
        handleGroup.setAttribute('pointer-events', 'none');
        this.createHandlesDOM(handleGroup);
        group.appendChild(handleGroup);

        this.root.appendChild(group);
        overlay = { group, rect, handleGroup, bbox: { x: 0, y: 0, width: 0, height: 0 } };
        this.overlays.set(g.id, overlay);
      }

      const pad = 2;
      overlay.rect.setAttribute('x', String(worldBBox.x - pad));
      overlay.rect.setAttribute('y', String(worldBBox.y - pad));
      overlay.rect.setAttribute('width', String(worldBBox.width + pad * 2));
      overlay.rect.setAttribute('height', String(worldBBox.height + pad * 2));

      overlay.bbox = worldBBox;
      this.updateHandlePositions(overlay.handleGroup, worldBBox);

      const m = g.matrix;
      const isIdentity =
        m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
      if (!isIdentity) {
        overlay.group.setAttribute(
          'transform',
          `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`,
        );
      } else {
        overlay.group.removeAttribute('transform');
      }
    }
  }

  public translateBy(dx: number, dy: number): void {
    for (const [, data] of this.overlays) {
      const x = parseFloat(data.rect.getAttribute('x') || '0') + dx;
      const y = parseFloat(data.rect.getAttribute('y') || '0') + dy;
      data.rect.setAttribute('x', String(x));
      data.rect.setAttribute('y', String(y));

      data.bbox = {
        x: data.bbox.x + dx,
        y: data.bbox.y + dy,
        width: data.bbox.width,
        height: data.bbox.height,
      };
      this.updateHandlePositions(data.handleGroup, data.bbox);
    }
  }

  public hitTestHandle(
    svgX: number,
    svgY: number,
  ): { handle: GroupHandlePosition; groupId: string } | null {
    for (const [groupId, data] of this.overlays) {
      const bbox = data.bbox;
      for (const { pos, cx, cy } of handleLocalPositions(
        bbox.width,
        bbox.height,
      )) {
        const hx = bbox.x + cx - HANDLE_OFFSET;
        const hy = bbox.y + cy - HANDLE_OFFSET;
        if (
          svgX >= hx &&
          svgX <= hx + HANDLE_SIZE &&
          svgY >= hy &&
          svgY <= hy + HANDLE_SIZE
        ) {
          return { handle: pos, groupId };
        }
      }
    }
    return null;
  }

  public clear(): void {
    for (const data of this.overlays.values()) {
      data.group.remove();
    }
    this.overlays.clear();
  }

  public getElement(): SVGGElement {
    return this.root;
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private createHandlesDOM(handleGroup: SVGGElement): void {
    for (let i = 0; i < 8; i++) {
      const handle = document.createElementNS(SVG_NS, 'rect');
      handle.setAttribute('fill', HANDLE_FILL);
      handle.setAttribute('stroke', HANDLE_STROKE);
      handle.setAttribute('stroke-width', '1.5');
      handle.setAttribute('pointer-events', 'none');
      handle.setAttribute('width', String(HANDLE_SIZE));
      handle.setAttribute('height', String(HANDLE_SIZE));
      handleGroup.appendChild(handle);
    }
  }

  private updateHandlePositions(
    handleGroup: SVGGElement,
    bbox: { x: number; y: number; width: number; height: number },
  ): void {
    const children = handleGroup.children;
    const positions = handleLocalPositions(bbox.width, bbox.height);
    for (let i = 0; i < children.length && i < positions.length; i++) {
      const handle = children[i] as SVGRectElement;
      const { cx, cy } = positions[i];
      handle.setAttribute('x', String(bbox.x + cx - HANDLE_OFFSET));
      handle.setAttribute('y', String(bbox.y + cy - HANDLE_OFFSET));
    }
  }
}
