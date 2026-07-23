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
  'use',
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

    const rectBg = this.createSvgElement('rect');
    rectBg.setAttribute('fill', 'none');
    rectBg.setAttribute('stroke', '#ffffff');
    rectBg.setAttribute('stroke-width', '2');
    rectBg.setAttribute('pointer-events', 'none');
    rectBg.setAttribute('shape-rendering', 'crispEdges');
    rectBg.setAttribute('vector-effect', 'non-scaling-stroke');
    elements.set('rect-bg', rectBg);
    g.appendChild(rectBg);

    const rectFg = this.createSvgElement('rect');
    rectFg.setAttribute('fill', 'none');
    rectFg.setAttribute('stroke', '#000000');
    rectFg.setAttribute('stroke-width', '2');
    rectFg.setAttribute('stroke-dasharray', '4 3');
    rectFg.setAttribute('pointer-events', 'none');
    rectFg.setAttribute('shape-rendering', 'crispEdges');
    rectFg.setAttribute('vector-effect', 'non-scaling-stroke');
    elements.set('rect-fg', rectFg);
    g.appendChild(rectFg);

    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
    for (const h of handles) {
      const path = this.createSvgElement('path');
      path.setAttribute(
        'd',
        'M6000 1000L3000 4000H5000V6000H3000L6000 9000L9000 6000H7000V4000H9000L6000 1000Z',
      );
      path.setAttribute('fill', '#000000');
      path.setAttribute('stroke', '#FFFFFF');
      path.setAttribute('stroke-width', '1');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.setAttribute('data-handle', h);
      elements.set(`h-${h}`, path);
      g.appendChild(path);
    }

    return { uuid, elements };
  }
}
