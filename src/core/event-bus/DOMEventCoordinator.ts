export type InputHandler = {
  onMouseDown?(e: MouseEvent): boolean;
  onMouseMove?(e: MouseEvent): boolean;
  onMouseUp?(e: MouseEvent): boolean;
  onDblClick?(e: MouseEvent): boolean;
  onKeyDown?(e: KeyboardEvent): boolean;
  onKeyUp?(e: KeyboardEvent): boolean;
  onWheel?(e: WheelEvent): boolean;
};

export class DOMEventCoordinator {
  private readonly svg: SVGSVGElement;
  private handlers: InputHandler[] = [];
  private bound = false;

  public constructor(svg: SVGSVGElement) {
    this.svg = svg;
  }

  public register(handler: InputHandler): void {
    this.handlers.push(handler);
  }

  public unregister(handler: InputHandler): void {
    const idx = this.handlers.indexOf(handler);
    if (idx >= 0) this.handlers.splice(idx, 1);
  }

  public bind(): void {
    if (this.bound) return;
    this.bound = true;

    this.svg.addEventListener('mousedown', (e: MouseEvent) => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i].onMouseDown?.(e)) return;
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i].onMouseMove?.(e)) return;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i].onMouseUp?.(e)) return;
      }
    });

    this.svg.addEventListener('dblclick', (e: MouseEvent) => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i].onDblClick?.(e)) return;
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i].onKeyDown?.(e)) return;
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i].onKeyUp?.(e)) return;
      }
    });

    this.svg.addEventListener('wheel', (e: WheelEvent) => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i].onWheel?.(e)) return;
      }
    });
  }

  public destroy(): void {
    this.handlers = [];
  }
}
