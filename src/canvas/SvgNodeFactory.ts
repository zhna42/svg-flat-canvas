import { NodeDOMFactory } from './NodeDOMFactory';

const SVG_TAGS = new Set([
  'rect',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'path',
  'text',
  'image',
  'g',
]);

const TAG_ALIASES: Record<string, string> = {
  'selection-box': 'g',
};

export class SvgNodeFactory extends NodeDOMFactory {
  public createDOM(type: string): SVGElement {
    const tag = TAG_ALIASES[type] || (SVG_TAGS.has(type) ? type : 'rect');
    return this.createSvgElement(tag as keyof SVGElementTagNameMap);
  }

  public createSelectionBox(): {
    uuid: string;
    elements: Map<string, SVGElement>;
  } {
    const uuid = crypto.randomUUID();
    const elements = new Map<string, SVGElement>();

    const g = this.createSvgElement('g');
    elements.set('g', g);

    const rect = this.createSvgElement('rect');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#4285f4');
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('stroke-dasharray', '4 2');
    rect.setAttribute('pointer-events', 'none');
    elements.set('rect', rect);
    g.appendChild(rect);

    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
    for (const h of handles) {
      const path = this.createSvgElement('path');
      path.setAttribute('d', 'M12 2L6 8H10V16H6L12 22L18 16H14V8H18L12 2Z');
      path.setAttribute('fill', '#000000');
      path.setAttribute('stroke', '#FFFFFF');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('data-handle', h);
      elements.set(`h-${h}`, path);
      g.appendChild(path);
    }

    return { uuid, elements };
  }
}
