import type { SvgNodeDto } from '@/dto/svg-node-dto';
import { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { RectElement } from '@/shapes/elements/RectElement';
import { CircleElement } from '@/shapes/elements/CircleElement';
import { EllipseElement } from '@/shapes/elements/EllipseElement';
import { LineElement } from '@/shapes/elements/LineElement';
import { PathElement } from '@/shapes/elements/PathElement';
import { PolygonElement } from '@/shapes/elements/PolygonElement';
import { PolylineElement } from '@/shapes/elements/PolylineElement';
import { TextElement } from '@/shapes/elements/TextElement';
import { ImageElement } from '@/shapes/elements/ImageElement';

const createByTag = (id: string, tag: string): AbstractGraphicElement => {
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
    default:
      return new RectElement(id);
  }
};

export const svgNodesToElements = (
  dtos: SvgNodeDto[],
): AbstractGraphicElement[] =>
  dtos.map((dto) => {
    const el = createByTag(dto.id, dto.tag);

    for (const [key, value] of Object.entries(dto.properties)) {
      if (el instanceof RectElement && key in el.geometry) {
        (el.geometry as any)[key] = parseFloat(value);
        el.markRenderKey(key);
        continue;
      }
      if (
        (el instanceof CircleElement || el instanceof EllipseElement) &&
        key in el.geometry
      ) {
        (el.geometry as any)[key] = parseFloat(value);
        el.markRenderKey(key);
        continue;
      }
      if (el instanceof LineElement && key in el.geometry) {
        (el.geometry as any)[key] = parseFloat(value);
        el.markRenderKey(key);
        continue;
      }
      if (el instanceof PathElement && key === 'd') {
        el.d = value;
        continue;
      }
      if (el instanceof PathElement && key === 'transformMatrix') {
        const nums = value.split(',').map(Number);
        if (nums.length === 6) {
          const [a, b, c, d, e, f] = nums;
          el.applyMatrixToD(a, b, c, d, e, f);
        }
        continue;
      }
      if (el instanceof PolygonElement && key === 'points') {
        el.points = value;
        el.markRenderKey('points');
        continue;
      }
      if (el instanceof PolylineElement && key === 'points') {
        el.points = value;
        el.markRenderKey('points');
        continue;
      }
      if (el instanceof TextElement) {
        if (key === 'textContent') {
          el.setTextContent(value);
          continue;
        }
        if (key === 'x') {
          el.posX = value;
          el.markRenderKey('x');
          continue;
        }
        if (key === 'y') {
          el.posY = value;
          el.markRenderKey('y');
          continue;
        }
        if (key === 'font-size') {
          el.fontSize = value;
          el.markRenderKey('font-size');
          continue;
        }
        if (key === 'font-family') {
          el.fontFamily = value;
          el.markRenderKey('font-family');
          continue;
        }
        if (key === 'text-anchor') {
          el.textAnchor = value;
          el.markRenderKey('text-anchor');
          continue;
        }
      }
      if (el instanceof ImageElement) {
        if (key === 'href') {
          el.href = value;
          el.markRenderKey('href');
          continue;
        }
        if (key in el.geometry) {
          (el.geometry as any)[key] = parseFloat(value);
          el.markRenderKey(key);
          continue;
        }
      }
      if (key === 'fill') { el.style.fill = value; el.markRenderKey('fill'); }
      else if (key === 'stroke') { el.style.stroke = value; el.markRenderKey('stroke'); }
      else if (key === 'stroke-width') { el.style.strokeWidth = parseFloat(value); el.markRenderKey('strokeWidth'); }
      else if (key === 'opacity') { el.style.opacity = parseFloat(value); el.markRenderKey('opacity'); }
    }

    el.setGroupId(dto.svgGroupId ?? '');
    el.setLaserGroupId(dto.laserGroupId ?? '');
    el.setLaserType(dto.laserActionType);
    el.setName(dto.tag);

    el.buildHitArea();

    return el;
  });

export const toSvgCanvasFormat = (
  dtos: SvgNodeDto[],
): AbstractGraphicElement[] => svgNodesToElements(dtos);
