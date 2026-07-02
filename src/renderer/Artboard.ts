import { RectElement } from '@/shapes/elements/RectElement';
import { MM_TO_PX, SVG_NS } from '@/constants';
import { applyElementToDOM } from '@/utils/render-utils';

export class Artboard {
  public readonly rect: RectElement;
  private _widthMM = 210;
  private _heightMM = 297;

  public constructor() {
    this.rect = new RectElement('artboard');
    this.rect.style.fill = '#ffffff';
    this.rect.setVisible(true);
    this.rect.data = { pointerEvents: 'none' };
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
  }

  public updateViewport(vw: number, vh: number): void {
    this.updateRect(vw, vh);
  }

  public createDOM(cameraGroup: SVGGElement, beforeNode: SVGGElement): SVGRectElement {
    const node = document.createElementNS(SVG_NS, 'rect');
    node.setAttribute('pointer-events', 'none');
    cameraGroup.insertBefore(node, beforeNode);
    applyElementToDOM(this.rect, node);
    return node;
  }

  private updateRect(_vw?: number, _vh?: number): void {
    const w = this._widthMM * MM_TO_PX;
    const h = this._heightMM * MM_TO_PX;
    this.rect.geometry.x = 0;
    this.rect.geometry.y = 0;
    this.rect.geometry.width = w;
    this.rect.geometry.height = h;
  }
}
