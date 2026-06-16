import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface SelectionOverlayCallbacks {
  onHandleMouseDown: (
    handle: HandlePosition,
    screenBBox: { x: number; y: number; width: number; height: number },
    element: AbstractGraphicElement,
    event: MouseEvent,
  ) => void;
}

const HANDLE_SIZE = 8;
const HANDLE_OFFSET = HANDLE_SIZE / 2;
const PADDING = 2;
const STROKE_COLOR = '#4285f4';
const HANDLE_FILL = '#fff';

interface HandleGroup {
  group: SVGGElement;
  rect: SVGRectElement;
  handlesGroup: SVGGElement;
}

export class SelectionOverlay {
  private readonly root: SVGGElement;
  private readonly camera: Camera;
  private groups: HandleGroup[] = [];
  private callbacks: SelectionOverlayCallbacks | null = null;

  public constructor(camera: Camera) {
    this.camera = camera;
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('pointer-events', 'none');
  }

  public setCallbacks(cb: SelectionOverlayCallbacks): void {
    this.callbacks = cb;
  }

  public getElement(): SVGGElement {
    return this.root;
  }

  public setElements(elements: readonly AbstractGraphicElement[]): void {
    this.clear();
    if (elements.length === 0) return;

    for (const el of elements) {
      const worldBBox = el.getWorldBBox();
      if (worldBBox.width === 0 && worldBBox.height === 0) continue;

      const screenBBox = this.camera.worldRectToScreen(worldBBox);

      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute(
        'transform',
        `translate(${screenBBox.x - PADDING}, ${screenBBox.y - PADDING})`,
      );

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(screenBBox.width + PADDING * 2));
      rect.setAttribute('height', String(screenBBox.height + PADDING * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', STROKE_COLOR);
      rect.setAttribute('stroke-width', '1.5');
      rect.setAttribute('stroke-dasharray', '4 2');
      rect.setAttribute('pointer-events', 'none');
      group.appendChild(rect);

      const handlesGroup = this.createHandles(
        screenBBox.width,
        screenBBox.height,
        el,
      );
      group.appendChild(handlesGroup);

      this.root.appendChild(group);
      this.groups.push({ group, rect, handlesGroup });
    }
  }

  public setPositions(elements: readonly AbstractGraphicElement[]): void {
    for (let i = 0; i < elements.length && i < this.groups.length; i++) {
      const worldBBox = elements[i].getWorldBBox();
      const screenBBox = this.camera.worldRectToScreen(worldBBox);
      const g = this.groups[i];

      g.group.setAttribute(
        'transform',
        `translate(${screenBBox.x - PADDING}, ${screenBBox.y - PADDING})`,
      );
      g.rect.setAttribute('width', String(screenBBox.width + PADDING * 2));
      g.rect.setAttribute('height', String(screenBBox.height + PADDING * 2));

      this.updateHandlePositions(g.handlesGroup, screenBBox.width, screenBBox.height);
    }
  }

  public showHandles(show: boolean): void {
    for (const g of this.groups) {
      g.handlesGroup.style.display = show ? '' : 'none';
    }
  }

  private clear(): void {
    while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
    this.groups = [];
  }

  private createHandles(
    w: number,
    h: number,
    el: AbstractGraphicElement,
  ): SVGGElement {
    const handlesGroup = document.createElementNS(SVG_NS, 'g');

    const positions: { pos: HandlePosition; cx: number; cy: number }[] = [
      { pos: 'nw', cx: 0, cy: 0 },
      { pos: 'n', cx: w / 2, cy: 0 },
      { pos: 'ne', cx: w, cy: 0 },
      { pos: 'e', cx: w, cy: h / 2 },
      { pos: 'se', cx: w, cy: h },
      { pos: 's', cx: w / 2, cy: h },
      { pos: 'sw', cx: 0, cy: h },
      { pos: 'w', cx: 0, cy: h / 2 },
    ];

    for (const { pos, cx, cy } of positions) {
      const handle = document.createElementNS(SVG_NS, 'rect');
      handle.setAttribute('x', String(cx - HANDLE_OFFSET));
      handle.setAttribute('y', String(cy - HANDLE_OFFSET));
      handle.setAttribute('width', String(HANDLE_SIZE));
      handle.setAttribute('height', String(HANDLE_SIZE));
      handle.setAttribute('fill', HANDLE_FILL);
      handle.setAttribute('stroke', STROKE_COLOR);
      handle.setAttribute('stroke-width', '1.5');
      handle.setAttribute('data-handle', pos);
      handle.setAttribute('cursor', this.handleCursor(pos));
      handle.setAttribute('pointer-events', 'all');

      const screenBBox = { x: 0, y: 0, width: w, height: h };

      handle.addEventListener('mousedown', (e) => {
        if (this.callbacks) {
          this.callbacks.onHandleMouseDown(
            pos,
            screenBBox,
            el,
            e,
          );
        }
      });

      handlesGroup.appendChild(handle);
    }

    return handlesGroup;
  }

  private updateHandlePositions(
    handlesGroup: SVGGElement,
    w: number,
    h: number,
  ): void {
    const children = handlesGroup.children;
    const positions = [
      { cx: 0, cy: 0 },
      { cx: w / 2, cy: 0 },
      { cx: w, cy: 0 },
      { cx: w, cy: h / 2 },
      { cx: w, cy: h },
      { cx: w / 2, cy: h },
      { cx: 0, cy: h },
      { cx: 0, cy: h / 2 },
    ];

    for (let i = 0; i < children.length && i < positions.length; i++) {
      const handle = children[i] as SVGRectElement;
      const { cx, cy } = positions[i];
      handle.setAttribute('x', String(cx - HANDLE_OFFSET));
      handle.setAttribute('y', String(cy - HANDLE_OFFSET));
    }
  }

  private handleCursor(pos: HandlePosition): string {
    switch (pos) {
      case 'nw': return 'nw-resize';
      case 'n': return 'n-resize';
      case 'ne': return 'ne-resize';
      case 'e': return 'e-resize';
      case 'se': return 'se-resize';
      case 's': return 's-resize';
      case 'sw': return 'sw-resize';
      case 'w': return 'w-resize';
      default: return 'default';
    }
  }

  public destroy(): void {
    this.root.remove();
  }
}
