import { Point } from '@/core/type';
import { ReactiveNode } from '@/core/ReactiveNode';

export class Camera extends ReactiveNode {
  public x = 0;
  public y = 0;
  public zoom = 1;
  public groupId = '';
  public panHeld = false;

  constructor(registerDirty: (instance: any) => void) {
    super('camera', 'g', 'overlayRoot');
    this.pushDiffRendering = registerDirty;
    registerDirty(this);
  }

  public getTransform(): string {
    return `translate(${this.x}, ${this.y}) scale(${this.zoom})`;
  }

  public pan(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  public setZoom(svgPoint: Point, factor: number): void {
    const newZoom = Math.max(0.2, Math.min(this.zoom * factor, 30));
    const worldX = (svgPoint.x - this.x) / this.zoom;
    const worldY = (svgPoint.y - this.y) / this.zoom;
    this.x = svgPoint.x - worldX * newZoom;
    this.y = svgPoint.y - worldY * newZoom;
    this.zoom = newZoom;
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public setZoomLevel(zoom: number): void {
    this.zoom = Math.max(0.2, Math.min(zoom, 30));
  }

  public screenToWorld(screenPoint: Point): Point {
    return {
      x: (screenPoint.x - this.x) / this.zoom,
      y: (screenPoint.y - this.y) / this.zoom,
    };
  }

  public worldToScreen(worldPoint: Point): Point {
    return {
      x: worldPoint.x * this.zoom + this.x,
      y: worldPoint.y * this.zoom + this.y,
    };
  }

  public worldRectToScreen(worldRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): { x: number; y: number; width: number; height: number } {
    const tl = this.worldToScreen({ x: worldRect.x, y: worldRect.y });
    const br = this.worldToScreen({
      x: worldRect.x + worldRect.width,
      y: worldRect.y + worldRect.height,
    });
    return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  }

  public toDTO(): Record<string, unknown> {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }

  public applyDTO(dto: Record<string, unknown>): void {
    if (typeof dto.x === 'number') this.x = dto.x;
    if (typeof dto.y === 'number') this.y = dto.y;
    if (typeof dto.zoom === 'number') this.zoom = dto.zoom;
  }

  public fitToViewport(
    contentWidth: number,
    contentHeight: number,
    viewWidth: number,
    viewHeight: number,
    padding = 20,
  ): void {
    const padX = viewWidth - padding * 2;
    const padY = viewHeight - padding * 2;
    const scaleX = padX / contentWidth;
    const scaleY = padY / contentHeight;
    this.zoom = Math.min(scaleX, scaleY);
    this.x = (viewWidth - contentWidth * this.zoom) / 2;
    this.y = (viewHeight - contentHeight * this.zoom) / 2;
  }
}
