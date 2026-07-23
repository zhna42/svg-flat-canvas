import { RectElement } from './elements/RectElement';
import { CircleElement } from './elements/CircleElement';
import { EllipseElement } from './elements/EllipseElement';
import { LineElement } from './elements/LineElement';
import { PathElement } from './elements/PathElement';
import { PolygonElement } from './elements/PolygonElement';
import { PolylineElement } from './elements/PolylineElement';
import { TextElement } from './elements/TextElement';
import { ImageElement } from './elements/ImageElement';
import { UseElement } from './elements/UseElement';
import { AbstractGraphicElement } from './elements/AbstractGraphicElement';
import type { ElementType, ElementJSON } from '@/core/type';

export const createElementByType = (
  type: string,
  id: string,
): AbstractGraphicElement | null => {
  switch (type) {
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
    case 'pattern':
      return null;
    case 'use':
      return new UseElement(id);
    default:
      return null;
  }
};

const createElement = (
  type: ElementType,
  id: string,
): AbstractGraphicElement => {
  switch (type) {
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
    case 'pattern':
      throw new Error('PatternElement cannot be created via factory');
    case 'use':
      throw new Error(
        'UseElement cannot be created via factory — use createUseElement',
      );
  }
};

export const createFromJSON = (json: ElementJSON): AbstractGraphicElement => {
  const el = createElement(json.type, json.id);

  for (const [key, value] of Object.entries(json.attributes)) {
    if (el instanceof RectElement && key in el.geometry) {
      (el.geometry as any)[key] = Math.round(parseFloat(value));
      continue;
    }
    if (
      (el instanceof CircleElement || el instanceof EllipseElement) &&
      key in el.geometry
    ) {
      (el.geometry as any)[key] = Math.round(parseFloat(value));
      continue;
    }
    if (el instanceof LineElement && key in el.geometry) {
      (el.geometry as any)[key] = Math.round(parseFloat(value));
      continue;
    }
    if (el instanceof PathElement && key === 'd') {
      el.d = value;
      continue;
    }
    if (el instanceof PolygonElement && key === 'points') {
      el.points = value;
      continue;
    }
    if (el instanceof PolylineElement && key === 'points') {
      el.points = value;
      continue;
    }
    if (el instanceof ImageElement && key in el.geometry) {
      (el.geometry as any)[key] = Math.round(parseFloat(value));
      continue;
    }
    if (el instanceof ImageElement && key === 'href') {
      el.href = value;
      continue;
    }
    if (el instanceof TextElement) {
      if (key === 'x') {
        el.boxX = Math.round(parseFloat(value));
        continue;
      }
      if (key === 'y') {
        el.boxY = Math.round(parseFloat(value));
        continue;
      }
      if (key === 'font-size') {
        el.textModel = [
          { ...el.defaultStyle, fontSize: parseFloat(value), text: '' },
        ];
        continue;
      }
      if (key === 'font-family') {
        if (el.textModel.length > 0) el.textModel[0].fontFamily = value;
        continue;
      }
      if (key === 'text-anchor') {
        el.align =
          value === 'middle' ? 'center' : value === 'end' ? 'right' : 'left';
        continue;
      }
    }
    if (key === 'fill') {
      el.style.fill = value;
    } else if (key === 'stroke') {
      el.style.stroke = value;
    } else if (key === 'stroke-width') {
      el.style.strokeWidth = Math.round(parseFloat(value));
    } else if (key === 'opacity') {
      el.style.opacity = parseFloat(value);
    } else if (key === 'visibility') {
      el.style.visible = value !== 'hidden';
    }
  }

  if (json.groupId) el.groupId = json.groupId;
  if (json.name !== undefined) el.name = json.name;
  if (json.visible !== undefined) {
    el.setVisible(json.visible);
  }
  if (json.lock !== undefined) el.lock = json.lock;
  if (json.data) {
    el.data = { ...json.data };
  }
  if (json.textContent && el instanceof TextElement) {
    const stripped = json.textContent.replace(/<[^>]*>/g, '');
    if (stripped.trim()) {
      if (el.textModel.length > 0) {
        el.textModel[0].text = stripped;
      } else {
        el.textModel = [{ ...el.defaultStyle, text: stripped }];
      }
    }
  }

  el.rebuildHitArea();
  el.clearTimeMachineDiff();
  return el;
};

export const createFromJSONArray = (
  items: ElementJSON[],
): AbstractGraphicElement[] => items.map(createFromJSON);
