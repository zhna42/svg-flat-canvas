import { RectElement } from '@/shapes/elements/RectElement';
import { MM_TO_PX } from '@/constants';

export class Artboard {
  public readonly rect: RectElement;
  private _dirty = false;
  private _widthMM = 210;
  private _heightMM = 297;

  public constructor() {
    this.rect = new RectElement('artboard');
    this.rect.style.fill = '#ffffff';
    this.rect.style.stroke = '#cccccc';
    this.rect.style.strokeWidth = 1;
    this.rect.visible = true;
    this.rect.data = { pointerEvents: 'none' };
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
    const viewW = vw ?? 800;
    const viewH = vh ?? 600;
    this.rect.geometry.x = (viewW - w) / 2;
    this.rect.geometry.y = (viewH - h) / 2;
    this.rect.geometry.width = w;
    this.rect.geometry.height = h;
    this.rect.setDirty();
  }
}
