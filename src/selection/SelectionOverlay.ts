import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { PathElement } from '@/shapes/elements/PathElement';
import type { Point } from '@/types';

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

const screenCorners = (el: AbstractGraphicElement, camera: Camera): Point[] => {
  return el.getWorldCorners().map((p) => camera.worldToScreen(p));
};

const handlePositions = (
  w: number,
  h: number,
): { pos: HandlePosition; cx: number; cy: number }[] => [
  { pos: 'nw', cx: 0, cy: 0 },
  { pos: 'n', cx: w / 2, cy: 0 },
  { pos: 'ne', cx: w, cy: 0 },
  { pos: 'e', cx: w, cy: h / 2 },
  { pos: 'se', cx: w, cy: h },
  { pos: 's', cx: w / 2, cy: h },
  { pos: 'sw', cx: 0, cy: h },
  { pos: 'w', cx: 0, cy: h / 2 },
];

export class SelectionOverlay {
  private readonly root: SVGGElement;
  private readonly camera: Camera;
  private groups: HandleGroup[] = [];
  private pathNodesGroup: SVGGElement;

  public constructor(camera: Camera) {
    this.camera = camera;
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('pointer-events', 'none');
    this.pathNodesGroup = document.createElementNS(SVG_NS, 'g');
    this.root.appendChild(this.pathNodesGroup);
  }

  public getElement(): SVGGElement {
    return this.root;
  }

  public setElements(elements: readonly AbstractGraphicElement[]): void {
    this.clear();
    this.clearPathNodes();
    if (elements.length === 0) return;

    for (const el of elements) {
      if (el.isNodeEditing) {
        this.renderPathNodes(el);
        continue;
      }

      const local = el.getBBox();
      if (local.width === 0 && local.height === 0) continue;

      const sc = screenCorners(el, this.camera);
      const sx = sc[0].x;
      const sy = sc[0].y;
      const sw = Math.sqrt((sc[1].x - sx) ** 2 + (sc[1].y - sy) ** 2);
      const sh = Math.sqrt((sc[3].x - sx) ** 2 + (sc[3].y - sy) ** 2);
      const angleRad = Math.atan2(sc[1].y - sy, sc[1].x - sx);
      const angleDeg = (angleRad * 180) / Math.PI;

      if (sw === 0 && sh === 0) continue;

      const group = document.createElementNS(SVG_NS, 'g');
      (group as any).__element = el;
      group.setAttribute(
        'transform',
        `translate(${sx - PADDING}, ${sy - PADDING}) rotate(${angleDeg})`,
      );

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(sw + PADDING * 2));
      rect.setAttribute('height', String(sh + PADDING * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', STROKE_COLOR);
      rect.setAttribute('stroke-width', '1.5');
      rect.setAttribute('stroke-dasharray', '4 2');
      rect.setAttribute('pointer-events', 'none');
      group.appendChild(rect);

      const handlesGroup = this.createHandles(sw, sh);
      group.appendChild(handlesGroup);

      this.root.appendChild(group);
      this.groups.push({ group, rect, handlesGroup });
    }
  }

  public setPositions(elements: readonly AbstractGraphicElement[]): void {
    for (let i = 0; i < elements.length && i < this.groups.length; i++) {
      const el = elements[i];

      if (el.isNodeEditing) {
        this.updatePathNodes(el);
        continue;
      }

      const local = el.getBBox();
      if (local.width === 0 && local.height === 0) continue;

      const sc = screenCorners(el, this.camera);
      const sx = sc[0].x;
      const sy = sc[0].y;
      const sw = Math.sqrt((sc[1].x - sx) ** 2 + (sc[1].y - sy) ** 2);
      const sh = Math.sqrt((sc[3].x - sx) ** 2 + (sc[3].y - sy) ** 2);
      const angleRad = Math.atan2(sc[1].y - sy, sc[1].x - sx);

      if (sw === 0 && sh === 0) continue;

      const g = this.groups[i];
      g.group.setAttribute(
        'transform',
        `translate(${sx - PADDING}, ${sy - PADDING}) rotate(${(angleRad * 180) / Math.PI})`,
      );
      g.rect.setAttribute('width', String(sw + PADDING * 2));
      g.rect.setAttribute('height', String(sh + PADDING * 2));

      this.updateHandlePositions(g.handlesGroup, sw, sh);
    }
  }

  public showHandles(show: boolean): void {
    for (const g of this.groups) {
      g.handlesGroup.style.display = show ? '' : 'none';
    }
  }

  public hitTestHandle(
    svgX: number,
    svgY: number,
  ): { handle: HandlePosition; element: AbstractGraphicElement } | null {
    for (const g of this.groups) {
      const el = (g.group as any).__element as AbstractGraphicElement;
      if (!el) continue;

      const local = el.getBBox();
      if (local.width === 0 && local.height === 0) continue;

      const sc = screenCorners(el, this.camera);
      const sx = sc[0].x;
      const sy = sc[0].y;
      const sw = Math.sqrt((sc[1].x - sx) ** 2 + (sc[1].y - sy) ** 2);
      const sh = Math.sqrt((sc[3].x - sx) ** 2 + (sc[3].y - sy) ** 2);
      const angleRad = Math.atan2(sc[1].y - sy, sc[1].x - sx);

      const dx = svgX - (sx - PADDING);
      const dy = svgY - (sy - PADDING);
      const cos = Math.cos(-angleRad);
      const sin = Math.sin(-angleRad);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      const positions = handlePositions(sw, sh);

      for (const { pos, cx, cy } of positions) {
        const hx = cx - HANDLE_OFFSET;
        const hy = cy - HANDLE_OFFSET;
        if (
          localX >= hx &&
          localX <= hx + HANDLE_SIZE &&
          localY >= hy &&
          localY <= hy + HANDLE_SIZE
        ) {
          return { handle: pos, element: el };
        }
      }
    }
    return null;
  }

  public hitTestPathNode(
    svgX: number,
    svgY: number,
  ): {
    elementId: string;
    cmdIdx: number;
    ptIdx: number;
  } | null {
    const handles = this.pathNodesGroup.querySelectorAll(
      '[data-type="path-node"]',
    );
    for (const handle of handles) {
      let hx: number;
      let hy: number;
      const tag = handle.tagName;

      if (tag === 'circle') {
        const cx = parseFloat(handle.getAttribute('cx') ?? '0');
        const cy = parseFloat(handle.getAttribute('cy') ?? '0');
        const r = parseFloat(handle.getAttribute('r') ?? '3.5');
        const dx = svgX - cx;
        const dy = svgY - cy;
        if (dx * dx + dy * dy > r * r) continue;
        hx = cx - r;
        hy = cy - r;
      } else {
        hx = parseFloat(handle.getAttribute('x') ?? '0');
        hy = parseFloat(handle.getAttribute('y') ?? '0');
        const w = HANDLE_SIZE;
        if (svgX < hx || svgX > hx + w || svgY < hy || svgY > hy + w) continue;
      }

      const elementId = handle.getAttribute('data-element-id');
      const cmdIdx = parseInt(handle.getAttribute('data-cmd-idx') ?? '', 10);
      const ptIdx = parseInt(handle.getAttribute('data-pt-idx') ?? '', 10);
      if (elementId && !isNaN(cmdIdx) && !isNaN(ptIdx)) {
        return { elementId, cmdIdx, ptIdx };
      }
    }
    return null;
  }

  private clear(): void {
    while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
    this.groups = [];
    this.pathNodesGroup = document.createElementNS(SVG_NS, 'g');
    this.root.appendChild(this.pathNodesGroup);
  }

  private clearPathNodes(): void {
    while (this.pathNodesGroup.firstChild) {
      this.pathNodesGroup.removeChild(this.pathNodesGroup.firstChild);
    }
  }

  private renderPathNodes(el: AbstractGraphicElement): void {
    if (!('getNodeEditPoints' in el)) return;
    const pathEl = el as unknown as PathElement;
    const nodes = pathEl.getNodeEditPoints();

    // Сначала рисуем линии для control точек
    for (const node of nodes) {
      if (node.type !== 'control' || !node.parentAnchor) continue;
      const screen = this.camera.worldToScreen({ x: node.x, y: node.y });
      const parentScreen = this.camera.worldToScreen(node.parentAnchor);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(parentScreen.x));
      line.setAttribute('y1', String(parentScreen.y));
      line.setAttribute('x2', String(screen.x));
      line.setAttribute('y2', String(screen.y));
      line.setAttribute('stroke', '#a0a0a0');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('pointer-events', 'none');
      this.pathNodesGroup.appendChild(line);
    }

    // Потом рисуем ручки
    for (const node of nodes) {
      const screen = this.camera.worldToScreen({ x: node.x, y: node.y });

      if (node.type === 'control') {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(screen.x));
        circle.setAttribute('cy', String(screen.y));
        circle.setAttribute('r', '3.5');
        circle.setAttribute('fill', HANDLE_FILL);
        circle.setAttribute('stroke', STROKE_COLOR);
        circle.setAttribute('stroke-width', '1.5');
        circle.setAttribute('data-type', 'path-node');
        circle.setAttribute('data-element-id', el.id);
        circle.setAttribute('data-cmd-idx', String(node.cmdIdx));
        circle.setAttribute('data-pt-idx', String(node.ptIdx));
        this.pathNodesGroup.appendChild(circle);
      } else {
        const handle = document.createElementNS(SVG_NS, 'rect');
        handle.setAttribute('x', String(screen.x - HANDLE_OFFSET));
        handle.setAttribute('y', String(screen.y - HANDLE_OFFSET));
        handle.setAttribute('width', String(HANDLE_SIZE));
        handle.setAttribute('height', String(HANDLE_SIZE));
        handle.setAttribute('fill', HANDLE_FILL);
        handle.setAttribute('stroke', STROKE_COLOR);
        handle.setAttribute('stroke-width', '1.5');
        handle.setAttribute('data-type', 'path-node');
        handle.setAttribute('data-element-id', el.id);
        handle.setAttribute('data-cmd-idx', String(node.cmdIdx));
        handle.setAttribute('data-pt-idx', String(node.ptIdx));
        this.pathNodesGroup.appendChild(handle);
      }
    }
  }

  public updatePathNodes(el: AbstractGraphicElement): void {
    this.clearPathNodes();
    this.renderPathNodes(el);
  }

  private createHandles(w: number, h: number): SVGGElement {
    const handlesGroup = document.createElementNS(SVG_NS, 'g');
    for (const { pos, cx, cy } of handlePositions(w, h)) {
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
    const positions = handlePositions(w, h);
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
