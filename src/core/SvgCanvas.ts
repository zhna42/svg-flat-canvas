import { EventManager } from '@/events/EventManager';
import { Renderer } from '@/renderer/Renderer';
import { ShapeManager } from '@/shapes/ShapeManager';
import type { SvgCanvasOptions } from '@/types';

export class SvgCanvas {
  private readonly element: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly renderer: Renderer;
  private readonly shapeManager: ShapeManager;
  private readonly eventManager: EventManager;

  public constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    this.element = container;
    this.svg = this.createSvgElement(options);
    this.renderer = new Renderer(this.svg);
    this.shapeManager = new ShapeManager(this.renderer);
    this.eventManager = new EventManager(this.svg);

    this.element.appendChild(this.svg);
    this.init();
  }

  public getSVG(): SVGSVGElement {
    return this.svg;
  }

  public destroy(): void {
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

  private init(): void {
    this.renderer.render();
  }
}
