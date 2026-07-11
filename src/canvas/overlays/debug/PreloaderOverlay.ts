import { SVG_NS } from '@/constants';

export class PreloaderOverlay {
  private readonly group: SVGGElement;
  private _visible = false;

  public constructor() {
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('pointer-events', 'none');
    this.build();
  }

  private build(): void {
    const cx = 50000;
    const cy = 50000;
    const r = 20000;
    const sw = 3000;

    const bg = document.createElementNS(SVG_NS, 'circle');
    bg.setAttribute('cx', String(cx));
    bg.setAttribute('cy', String(cy));
    bg.setAttribute('r', String(r));
    bg.setAttribute('fill', 'rgba(0,0,0,0.4)');
    bg.setAttribute('stroke', 'rgba(255,255,255,0.3)');
    bg.setAttribute('stroke-width', String(sw));
    this.group.appendChild(bg);

    const arc = document.createElementNS(SVG_NS, 'circle');
    arc.setAttribute('cx', String(cx));
    arc.setAttribute('cy', String(cy));
    arc.setAttribute('r', String(r));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', '#4285f4');
    arc.setAttribute('stroke-width', String(sw));
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute(
      'stroke-dasharray',
      `${Math.PI * r * 0.6} ${Math.PI * r * 0.4}`,
    );
    arc.setAttribute('transform-origin', `${cx} ${cy}`);
    this.group.appendChild(arc);

    const animate = document.createElementNS(SVG_NS, 'animateTransform');
    animate.setAttribute('attributeName', 'transform');
    animate.setAttribute('type', 'rotate');
    animate.setAttribute('from', `0 ${cx} ${cy}`);
    animate.setAttribute('to', `360 ${cx} ${cy}`);
    animate.setAttribute('dur', '1s');
    animate.setAttribute('repeatCount', 'indefinite');
    arc.appendChild(animate);
  }

  public getElement(): SVGGElement {
    return this.group;
  }

  public get visible(): boolean {
    return this._visible;
  }

  public show(x: number, y: number): void {
    this.group.setAttribute(
      'transform',
      `translate(${x - 50000}, ${y - 50000})`,
    );
    this.group.setAttribute('display', '');
    this._visible = true;
  }

  public showCentered(viewW: number, viewH: number): void {
    this.show(viewW / 2, viewH / 2);
  }

  public hide(): void {
    this.group.setAttribute('display', 'none');
    this._visible = false;
  }

  public destroy(): void {
    this.group.remove();
  }
}
