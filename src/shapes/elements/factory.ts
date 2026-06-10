import { RectElement } from './RectElement';
import { CircleElement } from './CircleElement';
import { EllipseElement } from './EllipseElement';
import { LineElement } from './LineElement';
import { PathElement } from './PathElement';
import { PolygonElement } from './PolygonElement';
import { PolylineElement } from './PolylineElement';
import { TextElement } from './TextElement';
import { ImageElement } from './ImageElement';
import { SvgElement } from './SvgElement';
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

export function createFromJSON(json: ElementJSON): SvgElement {
  const el = createElement(json.type, json.id);

  for (const [key, value] of Object.entries(json.attributes)) {
    el.element.setAttribute(key, value);
  }

  if (json.groupId) el.groupId = json.groupId;
  if (json.name !== undefined) el.name = json.name;
  if (json.visible !== undefined) el.visible = json.visible;
  if (json.lock !== undefined) el.lock = json.lock;
  if (json.data) el.data = { ...json.data };
  if (json.textContent && el instanceof TextElement) {
    el.setTextContent(json.textContent);
  }

  el.buildHitArea();
  return el;
}

export function createFromJSONArray(items: ElementJSON[]): SvgElement[] {
  return items.map(createFromJSON);
}

function createElement(type: ElementType, id: string): SvgElement {
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
  }
}
