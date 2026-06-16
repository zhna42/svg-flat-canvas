import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

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

  public constructor(camera: Camera) {
    this.camera = camera;
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('pointer-events', 'none');
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
      (group as any).__element = el;
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

  /**
   * Хит-тест в SVG координатах.
   * Проверяет, попал ли клик в одну из ручек выделенного элемента.
   * Возвращает { handle, element, screenBBox } или null.
   */
  public hitTestHandle(
    svgX: number,
    svgY: number,
  ): { handle: HandlePosition; element: AbstractGraphicElement; screenBBox: { x: number; y: number; width: number; height: number } } | null {
    for (const g of this.groups) {
      const el = (g.group as any).__element as AbstractGraphicElement;
      if (!el) continue;

      const worldBBox = el.getWorldBBox();
      const screenBBox = this.camera.worldRectToScreen(worldBBox);

      const groupX = screenBBox.x - PADDING;
      const groupY = screenBBox.y - PADDING;
      const localX = svgX - groupX;
      const localY = svgY - groupY;

      const w = screenBBox.width;
      const h = screenBBox.height;

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
        const hx = cx - HANDLE_OFFSET;
        const hy = cy - HANDLE_OFFSET;
        if (
          localX >= hx &&
          localX <= hx + HANDLE_SIZE &&
          localY >= hy &&
          localY <= hy + HANDLE_SIZE
        ) {
          return { handle: pos, element: el, screenBBox: { x: 0, y: 0, width: w, height: h } };
        }
      }
    }
    return null;
  }

  private clear(): void {
    while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
    this.groups = [];
  }

  private createHandles(w: number, h: number): SVGGElement {
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
      handle.setAttribute('pointer-events', 'none');
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

  public destroy(): void {
    this.root.remove();
  }
}
