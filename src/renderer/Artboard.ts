import { SVG_NS, MM_TO_PX } from '@/constants';

export class Artboard {
  private readonly rect: SVGRectElement;
  private _dirty = false;
  private _widthMM = 210;
  private _heightMM = 297;

  public constructor(parent: Node) {
    this.rect = document.createElementNS(SVG_NS, 'rect');
    this.rect.setAttribute('fill', '#ffffff');
    this.rect.setAttribute('stroke', '#cccccc');
    this.rect.setAttribute('stroke-width', '1');
    this.rect.setAttribute('pointer-events', 'none');
    parent.appendChild(this.rect);
  }

  public get dirty(): boolean {
    return this._dirty;
  }

  public markClean(): void {
    this._dirty = false;
  }

  public get widthMM(): number {
    return this._widthMM;
  }

  public get heightMM(): number {
    return this._heightMM;
  }

  public setSize(widthMM: number, heightMM: number): void {
    this._widthMM = widthMM;
    this._heightMM = heightMM;
    this.updateRect();
    this._dirty = true;
  }

  public updateViewport(vw: number, vh: number): void {
    this.updateRect(vw, vh);
  }

  private updateRect(vw?: number, vh?: number): void {
    const w = this._widthMM * MM_TO_PX;
    const h = this._heightMM * MM_TO_PX;
    const viewW =
      vw ??
      parseFloat(this.rect.closest('svg')?.getAttribute('width') || '800');
    const viewH =
      vh ??
      parseFloat(this.rect.closest('svg')?.getAttribute('height') || '600');
    const x = (viewW - w) / 2;
    const y = (viewH - h) / 2;
    this.rect.setAttribute('x', String(x));
    this.rect.setAttribute('y', String(y));
    this.rect.setAttribute('width', String(w));
    this.rect.setAttribute('height', String(h));
  }
}
