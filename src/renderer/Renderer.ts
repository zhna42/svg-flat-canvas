import { SVG_NS } from '@/constants';
import { Camera } from '@/camera/Camera';
import { Background } from './Background';
import { Artboard } from './Artboard';
import { RenderQueue } from './RenderQueue';
import { setRenderQueue } from '@/shapes/elements/render-queue-utils';
import { TAG_BY_TYPE, applyRenderSnapshot } from './render-utils';

export class Renderer {
  private readonly svg: SVGSVGElement;
  private readonly defs: SVGDefsElement;
  private readonly cameraGroup: SVGGElement;
  private readonly camera: Camera;
  private readonly artboard: Artboard;
  private readonly queue: RenderQueue;
  private readonly nodeMap = new Map<string, SVGElement>();
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

  public addElement(id: string, type: string): SVGElement {
    const tag = TAG_BY_TYPE[type] || 'rect';
    const el = document.createElementNS(SVG_NS, tag);
    this.nodeMap.set(id, el);
    if (this.overlayAnchor) {
      this.cameraGroup.insertBefore(el, this.overlayAnchor);
    } else {
      this.cameraGroup.appendChild(el);
    }
    return el;
  }

  public removeElement(id: string): void {
    const el = this.nodeMap.get(id);
    if (el) {
      this.cameraGroup.removeChild(el);
      this.nodeMap.delete(id);
    }
  }

  public clear(): void {
    for (const [, el] of this.nodeMap) {
      this.cameraGroup.removeChild(el);
    }
    this.nodeMap.clear();
  }

  public getNode(id: string): SVGElement | undefined {
    return this.nodeMap.get(id);
  }

  public appendOverlay(element: SVGElement): void {
    this.cameraGroup.appendChild(element);
    this.overlayAnchor = element as unknown as SVGGElement;
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
        const node = this.nodeMap.get(el.id);
        if (!node) continue;
        const snapshot = el.getRenderSnapshot();
        applyRenderSnapshot(snapshot, node);
        el.markClean();
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
