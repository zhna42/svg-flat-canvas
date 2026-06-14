import { SVG_NS } from '@/constants';
import type { Camera } from '@/camera/Camera';
import type { SvgElement } from '@/shapes/elements/SvgElement';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export interface SelectionOverlayCallbacks {
  onHandleMouseDown: (handle: HandlePosition, bbox: DOMRect, element: SvgElement, event: MouseEvent) => void;
}

interface ElementGroup {
  group: SVGGElement;
  bbox: { x: number; y: number; width: number; height: number };
}

export class SelectionOverlay {
  private readonly root: SVGGElement;
  private readonly camera: Camera;
  private elementGroups: ElementGroup[] = [];
  private callbacks: SelectionOverlayCallbacks | null = null;

  public constructor(camera: Camera) {
    this.camera = camera;
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('pointer-events', 'none');
  }

  public setCallbacks(cb: SelectionOverlayCallbacks): void { this.callbacks = cb; }
  public getElement(): SVGGElement { return this.root; }

  public setElements(elements: readonly SvgElement[]): void {
    this.clear();
    if (elements.length === 0) return;

    const z = this.camera.zoom;
    const pad = 2 / z;
    const sw = String(1.5 / z);
    const dash = String(4 / z) + ' ' + String(2 / z);
    const handleSize = 8 / z;

    for (const el of elements) {
      const bbox = el.getTransformedBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;

      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('transform', `translate(${bbox.x},${bbox.y})`);

      const rect = document.createElementNS(SVG_NS, 'rect');
      const rx = -pad;
      const ry = -pad;
      rect.setAttribute('x', String(rx));
      rect.setAttribute('y', String(ry));
      rect.setAttribute('width', String(bbox.width + pad * 2));
      rect.setAttribute('height', String(bbox.height + pad * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#4285f4');
      rect.setAttribute('stroke-width', sw);
      rect.setAttribute('stroke-dasharray', dash);
      rect.setAttribute('pointer-events', 'none');
      group.appendChild(rect);

      this.createHandles(group, bbox.width, bbox.height, handleSize, z, el);

      this.root.appendChild(group);
      this.elementGroups.push({ group, bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } });
    }
  }

  public setPositions(elements: readonly SvgElement[]): void {
    const pad = 2 / this.camera.zoom;
    for (let i = 0; i < elements.length && i < this.elementGroups.length; i++) {
      const bbox = elements[i].getTransformedBBox();
      const eg = this.elementGroups[i];
      eg.group.setAttribute('transform', `translate(${bbox.x},${bbox.y})`);
      const rect = eg.group.children[0] as SVGRectElement;
      if (rect) {
        rect.setAttribute('width', String(bbox.width + pad * 2));
        rect.setAttribute('height', String(bbox.height + pad * 2));
      }
    }
  }

  public showHandles(show: boolean): void {
    for (const eg of this.elementGroups) {
      const handles = eg.group.querySelector('[data-handle]')?.parentElement;
      if (handles) {
        (handles as unknown as SVGGElement).style.display = show ? '' : 'none';
      }
    }
  }

  private clear(): void {
    while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
    this.elementGroups = [];
  }

  private createHandles(group: SVGGElement, w: number, h: number, size: number, z: number, el: SvgElement): void {
    const hh = size / 2;
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

    const handlesGroup = document.createElementNS(SVG_NS, 'g');
    (group as any).__element = el;

    for (const { pos, cx, cy } of positions) {
      const handle = document.createElementNS(SVG_NS, 'rect');
      handle.setAttribute('x', String(cx - hh));
      handle.setAttribute('y', String(cy - hh));
      handle.setAttribute('width', String(size));
      handle.setAttribute('height', String(size));
      handle.setAttribute('fill', '#fff');
      handle.setAttribute('stroke', '#4285f4');
      handle.setAttribute('stroke-width', String(1.5 / z));
      handle.setAttribute('data-handle', pos);
      handle.setAttribute('cursor', this.handleCursor(pos));
      handle.setAttribute('pointer-events', 'all');
      handle.addEventListener('mousedown', (e) => {
        if (this.callbacks) this.callbacks.onHandleMouseDown(pos, new DOMRect(0, 0, w, h), el, e);
      });
      handlesGroup.appendChild(handle);
    }

    const rot = document.createElementNS(SVG_NS, 'circle');
    rot.setAttribute('cx', String(w / 2));
    rot.setAttribute('cy', String(-20 / z));
    rot.setAttribute('r', String(4 / z));
    rot.setAttribute('fill', '#fff');
    rot.setAttribute('stroke', '#4285f4');
    rot.setAttribute('stroke-width', String(1.5 / z));
    rot.setAttribute('data-handle', 'rotate');
    rot.setAttribute('cursor', 'grab');
    rot.setAttribute('pointer-events', 'all');
    rot.addEventListener('mousedown', (e) => {
      if (this.callbacks) this.callbacks.onHandleMouseDown('rotate', new DOMRect(0, 0, w, h), el, e);
    });
    handlesGroup.appendChild(rot);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(w / 2));
    line.setAttribute('y1', String(0));
    line.setAttribute('x2', String(w / 2));
    line.setAttribute('y2', String(-20 / z));
    line.setAttribute('stroke', '#4285f4');
    line.setAttribute('stroke-width', String(1.5 / z));
    line.setAttribute('pointer-events', 'none');
    handlesGroup.appendChild(line);

    group.appendChild(handlesGroup);
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

  public destroy(): void { this.root.remove(); }
}
