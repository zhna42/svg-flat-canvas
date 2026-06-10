import type { SvgNodeDto } from '@/dto/svg-node-dto';
import { SvgElement } from '@/shapes/elements/SvgElement';
import { RectElement } from '@/shapes/elements/RectElement';
import { CircleElement } from '@/shapes/elements/CircleElement';
import { EllipseElement } from '@/shapes/elements/EllipseElement';
import { LineElement } from '@/shapes/elements/LineElement';
import { PathElement } from '@/shapes/elements/PathElement';
import { PolygonElement } from '@/shapes/elements/PolygonElement';
import { PolylineElement } from '@/shapes/elements/PolylineElement';
import { TextElement } from '@/shapes/elements/TextElement';
import { ImageElement } from '@/shapes/elements/ImageElement';

function createByTag(id: string, tag: string): SvgElement {
  switch (tag) {
    case 'rect':
      return new RectElement(id);
    case 'circle':
      return new CircleElement(id);
    case 'ellipse':
      return new EllipseElement(id);
    case 'line':
      return new LineElement(id);
    case 'path':
      return new PathElement(id);
    case 'polygon':
      return new PolygonElement(id);
    case 'polyline':
      return new PolylineElement(id);
    case 'text':
      return new TextElement(id);
    case 'image':
      return new ImageElement(id);
    default: {
      const fallback = new RectElement(id);
      fallback.element.setAttribute('fill', '#ccc');
      fallback.element.setAttribute('stroke', '#999');
      fallback.element.setAttribute('stroke-width', '1');
      fallback.element.setAttribute('width', '20');
      fallback.element.setAttribute('height', '20');
      return fallback;
    }
  }
}

export function svgNodesToElements(dtos: SvgNodeDto[]): SvgElement[] {
  return dtos.map((dto) => {
    const el = createByTag(dto.id, dto.tag);

    for (const [key, value] of Object.entries(dto.properties)) {
      if (key === 'textContent') {
        if (el instanceof TextElement) {
          el.setTextContent(value);
        }
        continue;
      }
      if (key === 'href') {
        if (el instanceof ImageElement) {
          el.element.setAttributeNS(
            'http://www.w3.org/1999/xlink',
            'href',
            value,
          );
        } else {
          el.element.setAttribute(key, value);
        }
        continue;
      }
      if (key === 'transformMatrix' && el instanceof PathElement) {
        const nums = value.split(',').map(Number);
        if (nums.length === 6) {
          const [a, b, c, d, e, f] = nums;
          el.applyMatrixToD(a, b, c, d, e, f);
        }
        continue;
      }
      el.element.setAttribute(key, value);
    }

    el.groupId = dto.svgGroupId ?? '';
    el.laserGroupId = dto.laserGroupId ?? '';
    el.laserType = dto.laserActionType;
    el.name = dto.tag;

    el.buildHitArea();

    return el;
  });
}

export function toSvgCanvasFormat(dtos: SvgNodeDto[]): SvgElement[] {
  return svgNodesToElements(dtos);
}
