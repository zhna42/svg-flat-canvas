import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import type { Camera } from '@/canvas/Camera';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HANDLE_SIZE = 8;
const HANDLE_OFFSET = HANDLE_SIZE / 2;
const STROKE_COLOR = '#4285f4';
const HANDLE_FILL = '#fff';

export class PathNodeOverlay {
  private root: SVGGElement;
  private _activeCmdIdx = -1;
  private camera: Camera;

  constructor(camera: Camera) {
    this.camera = camera;
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('id', 'path-node-overlay');
    this.root.setAttribute('pointer-events', 'none');
  }

  get activeCmdIdx(): number {
    return this._activeCmdIdx;
  }

  set activeCmdIdx(idx: number) {
    this._activeCmdIdx = idx;
  }

  getElement(): SVGGElement {
    return this.root;
  }

  hitTestPathNode(
    svgX: number,
    svgY: number,
  ): {
    elementId: string;
    cmdIdx: number;
    ptIdx: number;
  } | null {
    const children = this.root.querySelectorAll('[data-element-id]');
    for (const el of children) {
      const tag = el.tagName;
      if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        if (svgX >= x && svgX <= x + w && svgY >= y && svgY <= y + h) {
          return {
            elementId: el.getAttribute('data-element-id') || '',
            cmdIdx: parseInt(el.getAttribute('data-cmd-idx') || '0', 10),
            ptIdx: parseInt(el.getAttribute('data-pt-idx') || '0', 10),
          };
        }
      } else if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const r = parseFloat(el.getAttribute('r') || '0');
        const dx = svgX - cx;
        const dy = svgY - cy;
        if (dx * dx + dy * dy <= r * r) {
          return {
            elementId: el.getAttribute('data-element-id') || '',
            cmdIdx: parseInt(el.getAttribute('data-cmd-idx') || '0', 10),
            ptIdx: parseInt(el.getAttribute('data-pt-idx') || '0', 10),
          };
        }
      }
    }
    return null;
  }

  renderPathNodes(el: AbstractGraphicElement): void {
    this.clear();
    if (!('getNodeEditPoints' in el)) return;
    const pathEl = el as unknown as PathElement;
    const nodes = pathEl.getNodeEditPoints();

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
      this.root.appendChild(line);
    }

    for (const node of nodes) {
      const screen = this.camera.worldToScreen({ x: node.x, y: node.y });
      const isActive =
        node.type === 'anchor' && node.cmdIdx === this._activeCmdIdx;
      const fillColor = isActive ? STROKE_COLOR : HANDLE_FILL;

      if (node.type === 'control') {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(screen.x));
        circle.setAttribute('cy', String(screen.y));
        circle.setAttribute('r', '3.5');
        circle.setAttribute('fill', fillColor);
        circle.setAttribute('stroke', STROKE_COLOR);
        circle.setAttribute('stroke-width', '1.5');
        circle.setAttribute('data-type', 'path-node');
        circle.setAttribute('data-element-id', el.id);
        circle.setAttribute('data-cmd-idx', String(node.cmdIdx));
        circle.setAttribute('data-pt-idx', String(node.ptIdx));
        this.root.appendChild(circle);
      } else {
        const handle = document.createElementNS(SVG_NS, 'rect');
        handle.setAttribute('x', String(screen.x - HANDLE_OFFSET));
        handle.setAttribute('y', String(screen.y - HANDLE_OFFSET));
        handle.setAttribute('width', String(HANDLE_SIZE));
        handle.setAttribute('height', String(HANDLE_SIZE));
        handle.setAttribute('fill', fillColor);
        handle.setAttribute('stroke', STROKE_COLOR);
        handle.setAttribute('stroke-width', '1.5');
        handle.setAttribute('data-type', 'path-node');
        handle.setAttribute('data-element-id', el.id);
        handle.setAttribute('data-cmd-idx', String(node.cmdIdx));
        handle.setAttribute('data-pt-idx', String(node.ptIdx));
        this.root.appendChild(handle);
      }
    }
  }

  updatePathNodes(el: AbstractGraphicElement): void {
    this.clear();
    this.renderPathNodes(el);
  }

  clear(): void {
    while (this.root.firstChild) {
      this.root.firstChild.remove();
    }
  }

  destroy(): void {
    this.clear();
    this.root.remove();
  }
}
