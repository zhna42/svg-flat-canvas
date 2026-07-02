import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
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

const handlePositions = (
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
  rect: SVGRectElement;
  handleGroup: SVGGElement;
  screenBBox: { x: number; y: number; width: number; height: number };
}

export class GroupSelectionOverlay {
  private readonly root: SVGGElement;
  private readonly camera: Camera;
  private overlays = new Map<string, GroupOverlayData>();

  public constructor(camera: Camera) {
    this.camera = camera;
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
        data.rect.remove();
        data.handleGroup.remove();
        this.overlays.delete(id);
      }
    }

    for (const g of groups) {
      const worldBBox = computeGroupWorldBBox(g, findElement);
      if (!worldBBox) continue;

      const screenBBox = this.camera.worldRectToScreen(worldBBox);

      let overlay = this.overlays.get(g.id);
      if (!overlay) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#4285f4');
        rect.setAttribute('stroke-width', '1.5');
        rect.setAttribute('stroke-dasharray', '6 3');
        rect.setAttribute('pointer-events', 'none');

        const handleGroup = document.createElementNS(SVG_NS, 'g');
        handleGroup.setAttribute('pointer-events', 'none');
        this.createHandlesDOM(handleGroup);

        this.root.appendChild(rect);
        this.root.appendChild(handleGroup);

        overlay = { rect, handleGroup, screenBBox: { x: 0, y: 0, width: 0, height: 0 } };
        this.overlays.set(g.id, overlay);
      }

      const pad = 2;
      overlay.rect.setAttribute('x', String(screenBBox.x - pad));
      overlay.rect.setAttribute('y', String(screenBBox.y - pad));
      overlay.rect.setAttribute('width', String(screenBBox.width + pad * 2));
      overlay.rect.setAttribute('height', String(screenBBox.height + pad * 2));

      overlay.screenBBox = screenBBox;
      this.updateHandlePositions(overlay.handleGroup, screenBBox);
    }
  }

  public translateBy(dx: number, dy: number): void {
    for (const [, data] of this.overlays) {
      const x = parseFloat(data.rect.getAttribute('x') || '0') + dx;
      const y = parseFloat(data.rect.getAttribute('y') || '0') + dy;
      data.rect.setAttribute('x', String(x));
      data.rect.setAttribute('y', String(y));

      data.screenBBox = {
        x: data.screenBBox.x + dx,
        y: data.screenBBox.y + dy,
        width: data.screenBBox.width,
        height: data.screenBBox.height,
      };
      this.updateHandlePositions(data.handleGroup, data.screenBBox);
    }
  }

  public rotateBy(angleDeg: number): void {
    for (const [, data] of this.overlays) {
      const cx = data.screenBBox.x + data.screenBBox.width / 2;
      const cy = data.screenBBox.y + data.screenBBox.height / 2;
      const tform = `rotate(${angleDeg} ${cx} ${cy})`;
      data.rect.setAttribute('transform', tform);
      data.handleGroup.setAttribute('transform', tform);
    }
  }

  public clearRotation(): void {
    for (const [, data] of this.overlays) {
      data.rect.removeAttribute('transform');
      data.handleGroup.removeAttribute('transform');
    }
  }

  public hitTestHandle(
    svgX: number,
    svgY: number,
  ): { handle: GroupHandlePosition; groupId: string } | null {
    for (const [groupId, data] of this.overlays) {
      const bbox = data.screenBBox;
      for (const { pos, cx, cy } of handlePositions(
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
      data.rect.remove();
      data.handleGroup.remove();
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
    const positions = handlePositions(bbox.width, bbox.height);
    for (let i = 0; i < children.length && i < positions.length; i++) {
      const handle = children[i] as SVGRectElement;
      const { cx, cy } = positions[i];
      handle.setAttribute('x', String(bbox.x + cx - HANDLE_OFFSET));
      handle.setAttribute('y', String(bbox.y + cy - HANDLE_OFFSET));
    }
  }
}
