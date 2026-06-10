import { SVG_NS } from '@/constants';

export class Background {
  public constructor(svg: SVGSVGElement, defs: SVGDefsElement) {
    const pattern = document.createElementNS(SVG_NS, 'pattern');
    pattern.id = 'bg-checkers';
    pattern.setAttribute('width', '16');
    pattern.setAttribute('height', '16');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', '16');
    bg.setAttribute('height', '16');
    bg.setAttribute('fill', '#f0f0f0');
    pattern.appendChild(bg);

    const cell = document.createElementNS(SVG_NS, 'rect');
    cell.setAttribute('width', '8');
    cell.setAttribute('height', '8');
    cell.setAttribute('fill', '#e0e0e0');
    pattern.appendChild(cell);

    const cell2 = document.createElementNS(SVG_NS, 'rect');
    cell2.setAttribute('x', '8');
    cell2.setAttribute('y', '8');
    cell2.setAttribute('width', '8');
    cell2.setAttribute('height', '8');
    cell2.setAttribute('fill', '#e0e0e0');
    pattern.appendChild(cell2);

    defs.appendChild(pattern);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', '-10000');
    rect.setAttribute('y', '-10000');
    rect.setAttribute('width', '20000');
    rect.setAttribute('height', '20000');
    rect.setAttribute('fill', 'url(#bg-checkers)');
    rect.setAttribute('pointer-events', 'none');
    svg.insertBefore(rect, svg.firstChild);
  }
}
