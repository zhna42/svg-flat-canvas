import { SVG_NS } from '@/constants';
import { Camera } from '@/camera/Camera';
import { Background } from './Background';
import { Artboard } from './Artboard';
import { RenderQueue } from './RenderQueue';
import { setRenderQueue } from '@/shapes/elements/SvgElement';

export class Renderer {
  private readonly svg: SVGSVGElement;
  private readonly defs: SVGDefsElement;
  private readonly cameraGroup: SVGGElement;
  private readonly camera: Camera;
  private readonly artboard: Artboard;
  private readonly queue: RenderQueue;

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
        const tx = (el as any)._translate?.x;
        const ty = (el as any)._translate?.y;
        if (tx !== undefined && (tx !== 0 || ty !== 0)) {
          (el as any).element.setAttribute(
            'transform',
            `translate(${tx}, ${ty})`,
          );
        }
        if ('markClean' in el) el.markClean();
      }
      // Also re-render selection overlay when elements are dirty
      if (pending.length > 0) {
        // this is just a render tick; overlay update is triggered externally
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
