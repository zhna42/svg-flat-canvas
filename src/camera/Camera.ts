import type { Point } from '@/types';

export class Camera {
  public x = 0;
  public y = 0;
  public zoom = 1;

  private _dirty = false;

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
  }

  public setZoom(viewportPoint: Point, factor: number): void {
    const newZoom = Math.max(0.05, Math.min(this.zoom * factor, 50));

    const worldX = (viewportPoint.x - this.x) / this.zoom;
    const worldY = (viewportPoint.y - this.y) / this.zoom;

    this.x = viewportPoint.x - worldX * newZoom;
    this.y = viewportPoint.y - worldY * newZoom;
    this.zoom = newZoom;
    this._dirty = true;
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this._dirty = true;
  }

  public setZoomLevel(zoom: number): void {
    this.zoom = Math.max(0.05, Math.min(zoom, 50));
    this._dirty = true;
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
  }
}
