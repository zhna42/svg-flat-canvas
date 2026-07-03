import { SVG_NS } from '@/constants';

export class SelectionOverlayElement {
  public readonly id: string;
  public readonly group: SVGGElement;
  public readonly rect: SVGRectElement;
  public readonly handlesGroup: SVGGElement;

  private _dirtyTransform = false;
  private _dirtyGeometry = false;
  private _x = 0;
  private _y = 0;
  private _width = 0;
  private _height = 0;
  private _angle = 0;
  private _transformStr: string | null = null;
  private _visible = true;

  public constructor(id: string) {
    this.id = id;

    this.group = document.createElementNS(SVG_NS, 'g');
    (this.group as any).__overlayId = id;

    this.rect = document.createElementNS(SVG_NS, 'rect');
    this.rect.setAttribute('fill', 'none');
    this.rect.setAttribute('stroke', '#4285f4');
    this.rect.setAttribute('stroke-width', '1.5');
    this.rect.setAttribute('stroke-dasharray', '4 2');
    this.rect.setAttribute('pointer-events', 'none');
    this.group.appendChild(this.rect);

    this.handlesGroup = document.createElementNS(SVG_NS, 'g');
    this.group.appendChild(this.handlesGroup);
  }

  public get x(): number {
    return this._x;
  }
  public get y(): number {
    return this._y;
  }
  public get width(): number {
    return this._width;
  }
  public get height(): number {
    return this._height;
  }
  public get angle(): number {
    return this._angle;
  }

  public setTransform(
    x: number,
    y: number,
    angle: number,
    padding: number,
  ): void {
    this._x = x - padding;
    this._y = y - padding;
    this._angle = angle;
    this._dirtyTransform = true;
  }

  public setRect(width: number, height: number, padding: number): void {
    this._width = width + padding * 2;
    this._height = height + padding * 2;
    this._dirtyGeometry = true;
  }

  public translateBy(dx: number, dy: number): void {
    this._x += dx;
    this._y += dy;
    this._dirtyTransform = true;
  }

  public setVisible(v: boolean): void {
    this._visible = v;
    this._dirtyTransform = true;
  }

  public get dirty(): boolean {
    return this._dirtyTransform || this._dirtyGeometry;
  }

  public markClean(): void {
    this._dirtyTransform = false;
    this._dirtyGeometry = false;
  }

  public flushToDOM(): void {
    if (this._dirtyTransform) {
      this._transformStr = `translate(${this._x}, ${this._y}) rotate(${this._angle}, ${2}, ${2})`;
      this.group.setAttribute('transform', this._transformStr);
      this.group.setAttribute(
        'visibility',
        this._visible ? 'visible' : 'hidden',
      );
    }
    if (this._dirtyGeometry) {
      this.rect.setAttribute('width', String(this._width));
      this.rect.setAttribute('height', String(this._height));
    }
    this.markClean();
  }
}
