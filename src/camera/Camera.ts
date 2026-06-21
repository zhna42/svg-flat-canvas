import type { Point } from '@/types';

export class Camera {
  public x = 0;
  public y = 0;
  public zoom = 1;
  public cameraGroup: SVGGElement | null = null;

  private _dirty = false;
  public onChange: (() => void) | null = null;

  public get dirty(): boolean {
    return this._dirty;
  }

  public markClean(): void {
    this._dirty = false;
  }

  public getTransform(): string {
    return `translate(${this.x}, ${this.y}) scale(${this.zoom})`;
  }

  public pan(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this._dirty = true;
    this.cameraGroup?.setAttribute('transform', this.getTransform());
    this.onChange?.();
  }

  public setZoom(svgPoint: Point, factor: number): void {
    const newZoom = Math.max(0.05, Math.min(this.zoom * factor, 50));

    const worldX = (svgPoint.x - this.x) / this.zoom;
    const worldY = (svgPoint.y - this.y) / this.zoom;

    this.x = svgPoint.x - worldX * newZoom;
    this.y = svgPoint.y - worldY * newZoom;
    this.zoom = newZoom;
    this._dirty = true;
    this.cameraGroup?.setAttribute('transform', this.getTransform());
    this.onChange?.();
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this._dirty = true;
    this.cameraGroup?.setAttribute('transform', this.getTransform());
    this.onChange?.();
  }

  public setZoomLevel(zoom: number): void {
    this.zoom = Math.max(0.05, Math.min(zoom, 50));
    this._dirty = true;
    this.cameraGroup?.setAttribute('transform', this.getTransform());
    this.onChange?.();
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
    this._dirty = true;
    this.onChange?.();
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

    this.x = (viewWidth - viewWidth * this.zoom) / 2;
    this.y = (viewHeight - viewHeight * this.zoom) / 2;
    this._dirty = true;
    this.onChange?.();
  }
}
