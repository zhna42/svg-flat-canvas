import { SVG_NS } from '@/constants';
import { Camera } from '@/camera/Camera';
import { Background } from './Background';
import { Artboard } from './Artboard';

export class Renderer {
  private readonly svg: SVGSVGElement;
  private readonly defs: SVGDefsElement;
  private readonly cameraGroup: SVGGElement;
  private readonly camera: Camera;
  private readonly artboard: Artboard;

  private rafId: number | null = null;

  public constructor(svg: SVGSVGElement, camera: Camera) {
    this.svg = svg;
    this.camera = camera;

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

  public addElement(element: SVGElement): void {
    this.cameraGroup.appendChild(element);
  }

  public removeElement(element: SVGElement): void {
    this.cameraGroup.removeChild(element);
  }

  public destroy(): void {
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
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
