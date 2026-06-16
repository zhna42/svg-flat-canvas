import { SVG_NS } from '@/constants';
import { Camera } from '@/camera/Camera';
import { Background } from './Background';
import { Artboard } from './Artboard';
import { RenderQueue } from './RenderQueue';
import { setRenderQueue } from '@/shapes/elements/SvgElement';
import type { RenderSnapshot } from '@/shapes/elements/SvgElement';

function applySpecialProperty(element: SVGElement, key: string, value: unknown): boolean {
  if (key === 'textContent') {
    element.textContent = String(value);
    return true;
  }
  if (key === 'href') {
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', String(value));
    return true;
  }
  return false;
}

function applyRenderSnapshot(snapshot: RenderSnapshot, element: SVGElement): void {
  const { matrix, style, visible } = snapshot;

  if (matrix && matrix.length === 6) {
    const [a, b, c, d, e, f] = matrix;
    if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || e !== 0 || f !== 0) {
      element.setAttribute('transform', `matrix(${a},${b},${c},${d},${e},${f})`);
    } else {
      element.removeAttribute('transform');
    }
  }

  const s = style as Record<string, unknown>;
  if (s.fill !== undefined && s.fill !== '') element.setAttribute('fill', s.fill as string);
  else element.removeAttribute('fill');
  if (s.stroke !== undefined && s.stroke !== '') element.setAttribute('stroke', s.stroke as string);
  else element.removeAttribute('stroke');
  if (s.strokeWidth !== undefined) element.setAttribute('stroke-width', String(s.strokeWidth));
  if (s.opacity !== undefined) element.setAttribute('opacity', String(s.opacity));
  element.setAttribute('visibility', visible ? 'visible' : 'hidden');

  const g = snapshot.geometry;

  for (const [key, value] of Object.entries(g)) {
    if (value !== undefined) {
      if (!applySpecialProperty(element, key, value)) {
        element.setAttribute(key, String(value));
      }
    }
  }
}

export class Renderer {
  private readonly svg: SVGSVGElement;
  private readonly defs: SVGDefsElement;
  private readonly cameraGroup: SVGGElement;
  private readonly camera: Camera;
  private readonly artboard: Artboard;
  private readonly queue: RenderQueue;
  private overlayAnchor: SVGGElement | null = null;

  private rafId: number | null = null;

  public constructor(svg: SVGSVGElement, camera: Camera) {
    this.svg = svg;
    this.camera = camera;
    this.queue = new RenderQueue();

    setRenderQueue(this.queue);

    const ns = SVG_NS;
    this.defs = document.createElementNS(ns, 'defs');
    this.svg.appendChild(this.defs);

    new Background(svg, this.defs);

    this.cameraGroup = document.createElementNS(ns, 'g');
    this.svg.appendChild(this.cameraGroup);

    this.artboard = new Artboard(this.cameraGroup);

    this.startLoop();
  }

  public getCameraGroup(): SVGGElement {
    return this.cameraGroup;
  }

  public getArtboard(): Artboard {
    return this.artboard;
  }

  public getQueue(): RenderQueue {
    return this.queue;
  }

  public addElement(element: SVGElement): void {
    this.cameraGroup.appendChild(element);
  }

  public removeElement(element: SVGElement): void {
    this.cameraGroup.removeChild(element);
  }

  public appendOverlay(element: SVGElement): void {
    this.cameraGroup.appendChild(element);
    this.overlayAnchor = element as unknown as SVGGElement;
  }

  public addElementShaped(element: SVGElement): void {
    if (this.overlayAnchor) {
      this.cameraGroup.insertBefore(element, this.overlayAnchor);
    } else {
      this.cameraGroup.appendChild(element);
    }
  }

  public destroy(): void {
    setRenderQueue(null);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startLoop(): void {
    const tick = (): void => {
      if (this.camera.dirty) {
        this.cameraGroup.setAttribute('transform', this.camera.getTransform());
        this.camera.markClean();
      }

      const pending = this.queue.drain();
      for (const el of pending) {
        const snapshot = el.getRenderSnapshot();
        applyRenderSnapshot(snapshot, el.element);
        if ('markClean' in el) el.markClean();
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
