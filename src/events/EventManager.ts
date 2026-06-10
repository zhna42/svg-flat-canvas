export class EventManager {
  private readonly svg: SVGSVGElement;
  private readonly handlers: Array<
    [string, EventListenerOrEventListenerObject]
  > = [];

  public constructor(svg: SVGSVGElement) {
    this.svg = svg;
  }

  public on(event: string, handler: EventListenerOrEventListenerObject): void {
    this.svg.addEventListener(event, handler);
    this.handlers.push([event, handler]);
  }

  public off(event: string, handler: EventListenerOrEventListenerObject): void {
    this.svg.removeEventListener(event, handler);
    this.handlers.splice(this.handlers.indexOf([event, handler]), 1);
  }

  public destroy(): void {
    for (const [event, handler] of this.handlers) {
      this.svg.removeEventListener(event, handler);
    }
    this.handlers.length = 0;
  }
}
