import { EventManager } from '@/events/EventManager';
import { Renderer } from '@/renderer/Renderer';
import { ShapeManager } from '@/shapes/ShapeManager';
import { Camera } from '@/camera/Camera';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import { createFromJSONArray } from '@/shapes/elements/factory';
import type { ElementJSON } from '@/shapes/elements/factory';
import type { SvgCanvasOptions } from '@/types';

export class SvgCanvas {
  private readonly element: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly camera: Camera;
  private readonly renderer: Renderer;
  private readonly shapeManager: ShapeManager;
  private readonly eventManager: EventManager;

  public constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    this.element = container;
    this.svg = this.createSvgElement(options);
    this.camera = new Camera();
    this.renderer = new Renderer(this.svg, this.camera);
    this.shapeManager = new ShapeManager(this.renderer);
    this.eventManager = new EventManager(this.svg);

    this.element.appendChild(this.svg);
  }

  public getSVG(): SVGSVGElement {
    return this.svg;
  }

  public getCamera(): Camera {
    return this.camera;
  }

  public addShape(shape: SvgElement): void {
    this.shapeManager.add(shape);
  }

  public loadJSON(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
    }
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    const artboard = this.renderer.getArtboard();
    artboard.setSize(widthMM, heightMM);

    const vw = parseFloat(this.svg.getAttribute('width') || '800');
    const vh = parseFloat(this.svg.getAttribute('height') || '600');
    const pw = widthMM * 3.7795;
    const ph = heightMM * 3.7795;
    this.camera.fitToViewport(pw, ph, vw, vh, 40);
  }

  public destroy(): void {
    this.renderer.destroy();
    this.eventManager.destroy();
    this.shapeManager.clear();
    this.svg.remove();
  }

  private createSvgElement(options?: SvgCanvasOptions): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(options?.width ?? 800));
    svg.setAttribute('height', String(options?.height ?? 600));
    svg.setAttribute(
      'viewBox',
      `0 0 ${options?.width ?? 800} ${options?.height ?? 600}`,
    );
    return svg;
  }
}
