import { RectElement } from './RectElement';
import { CircleElement } from './CircleElement';
import { EllipseElement } from './EllipseElement';
import { LineElement } from './LineElement';
import { PathElement } from './PathElement';
import { PolygonElement } from './PolygonElement';
import { PolylineElement } from './PolylineElement';
import { TextElement } from './TextElement';
import { ImageElement } from './ImageElement';
import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { ElementType } from '@/types';

export interface ElementJSON {
  id: string;
  type: ElementType;
  attributes: Record<string, string>;
  groupId?: string;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  data?: Record<string, unknown>;
  textContent?: string;
}

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
  }
};

export const createFromJSON = (json: ElementJSON): AbstractGraphicElement => {
  const el = createElement(json.type, json.id);

  for (const [key, value] of Object.entries(json.attributes)) {
    if (el instanceof RectElement && key in el.geometry) {
      (el.geometry as any)[key] = parseFloat(value);
      continue;
    }
    if (
      (el instanceof CircleElement || el instanceof EllipseElement) &&
      key in el.geometry
    ) {
      (el.geometry as any)[key] = parseFloat(value);
      continue;
    }
    if (el instanceof LineElement && key in el.geometry) {
      (el.geometry as any)[key] = parseFloat(value);
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
      (el.geometry as any)[key] = parseFloat(value);
      continue;
    }
    if (el instanceof ImageElement && key === 'href') {
      el.href = value;
      continue;
    }
    if (el instanceof TextElement) {
      if (key === 'x') {
        el.posX = value;
        continue;
      }
      if (key === 'y') {
        el.posY = value;
        continue;
      }
      if (key === 'font-size') {
        el.fontSize = value;
        continue;
      }
      if (key === 'font-family') {
        el.fontFamily = value;
        continue;
      }
      if (key === 'text-anchor') {
        el.textAnchor = value;
        continue;
      }
    }
    if (key === 'fill') el.style.fill = value;
    else if (key === 'stroke') el.style.stroke = value;
    else if (key === 'stroke-width') el.style.strokeWidth = parseFloat(value);
    else if (key === 'opacity') el.style.opacity = parseFloat(value);
    else if (key === 'visibility') el.style.visible = value !== 'hidden';
  }

  if (json.groupId) el.groupId = json.groupId;
  if (json.name !== undefined) el.name = json.name;
  if (json.visible !== undefined) {
    el.visible = json.visible;
    el.style.visible = json.visible;
  }
  if (json.lock !== undefined) el.lock = json.lock;
  if (json.data) el.data = { ...json.data };
  if (json.textContent && el instanceof TextElement)
    el.setTextContent(json.textContent);

  el.buildHitArea();
  return el;
};

export const createFromJSONArray = (
  items: ElementJSON[],
): AbstractGraphicElement[] => items.map(createFromJSON);
