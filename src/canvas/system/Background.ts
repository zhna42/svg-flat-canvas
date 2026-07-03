export class Background {
  readonly el: SVGRectElement;
  _visible = true;

  constructor(svgRoot: SVGSVGElement, defs: SVGDefsElement) {
    const ns = 'http://www.w3.org/2000/svg';

    const pattern = document.createElementNS(ns, 'pattern');
    pattern.id = 'bg-checkers';
    pattern.setAttribute('width', '16');
    pattern.setAttribute('height', '16');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', '16');
    bg.setAttribute('height', '16');
    bg.setAttribute('fill', '#f0f0f0');
    pattern.appendChild(bg);

    for (const cell of [
      { x: 0, y: 0 },
      { x: 8, y: 8 },
    ]) {
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', String(cell.x));
      r.setAttribute('y', String(cell.y));
      r.setAttribute('width', '8');
      r.setAttribute('height', '8');
      r.setAttribute('fill', '#e0e0e0');
      pattern.appendChild(r);
    }

    defs.appendChild(pattern);

    this.el = document.createElementNS(ns, 'rect');
    this.el.setAttribute('x', '-10000');
    this.el.setAttribute('y', '-10000');
    this.el.setAttribute('width', '20000');
    this.el.setAttribute('height', '20000');
    this.el.setAttribute('fill', 'url(#bg-checkers)');
    this.el.setAttribute('pointer-events', 'none');

    const cameraGroup = svgRoot.querySelector('g');
    if (cameraGroup) {
      svgRoot.insertBefore(this.el, cameraGroup);
    } else {
      svgRoot.insertBefore(this.el, svgRoot.firstChild);
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(v: boolean) {
    this._visible = v;
    this.el.setAttribute('visibility', v ? 'visible' : 'hidden');
  }
}
