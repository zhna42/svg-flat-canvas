import { RectElement } from '@/shapes/elements/RectElement';
import { PatternElement } from '@/shapes/elements/PatternElement';
import { SVG_NS } from '@/constants';
import { applyElementToDOM } from '@/utils/render-utils';

export class Background {
  public readonly pattern: PatternElement;
  public readonly fillRect: RectElement;

  public constructor() {
    this.pattern = new PatternElement('bg-checkers');
    this.pattern.cells = [
      { x: 0, y: 0, width: 8, height: 8, fill: '#e0e0e0' },
      { x: 8, y: 8, width: 8, height: 8, fill: '#e0e0e0' },
    ];
    this.pattern.geometry.patternUnits = 'userSpaceOnUse';

    this.fillRect = new RectElement('bg-fill');
    this.fillRect.geometry.x = -10000;
    this.fillRect.geometry.y = -10000;
    this.fillRect.geometry.width = 20000;
    this.fillRect.geometry.height = 20000;
    this.fillRect.style.fill = 'url(#bg-checkers)';
    this.fillRect.style.visible = true;
    this.fillRect.visible = true;
  }

  public createDOM(svg: SVGSVGElement, defs: SVGDefsElement): void {
    const p = this.pattern;

    const patternNode = document.createElementNS(SVG_NS, 'pattern');
    patternNode.id = p.id;
    patternNode.setAttribute('width', String(p.geometry.width));
    patternNode.setAttribute('height', String(p.geometry.height));
    patternNode.setAttribute('patternUnits', p.geometry.patternUnits);

    const bgRect = document.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('width', String(p.geometry.width));
    bgRect.setAttribute('height', String(p.geometry.height));
    bgRect.setAttribute('fill', '#f0f0f0');
    patternNode.appendChild(bgRect);

    for (const cell of p.cells) {
      const cellNode = document.createElementNS(SVG_NS, 'rect');
      cellNode.setAttribute('x', String(cell.x));
      cellNode.setAttribute('y', String(cell.y));
      cellNode.setAttribute('width', String(cell.width));
      cellNode.setAttribute('height', String(cell.height));
      cellNode.setAttribute('fill', cell.fill);
      patternNode.appendChild(cellNode);
    }

    defs.appendChild(patternNode);

    const fillNode = document.createElementNS(SVG_NS, 'rect');
    fillNode.setAttribute('pointer-events', 'none');
    svg.insertBefore(fillNode, svg.firstChild);

    applyElementToDOM(this.fillRect, fillNode);
  }
}
