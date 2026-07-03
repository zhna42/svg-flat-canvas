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

export class SvgNodeFactory extends NodeDOMFactory {
  public createDOM(type: string): SVGElement {
    const tag = SVG_TAGS.has(type) ? type : 'rect';
    return this.createSvgElement(tag as keyof SVGElementTagNameMap);
  }
}
