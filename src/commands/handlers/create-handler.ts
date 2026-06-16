import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { ShapeManager } from '@/shapes/ShapeManager';
import {
  RectElement,
  CircleElement,
  EllipseElement,
  LineElement,
  PolylineElement,
  PolygonElement,
} from '@/shapes/elements';

const ELEMENT_CLASS_MAP: Record<string, new (id: string) => any> = {
  rect: RectElement,
  circle: CircleElement,
  ellipse: EllipseElement,
  line: LineElement,
  polyline: PolylineElement,
  polygon: PolygonElement,
};

export const createCreateHandler = (
  shapeManager: ShapeManager,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'CREATE') return;

    const { elementType, elementId, geometry, style } = command.options;

    const Cls = ELEMENT_CLASS_MAP[elementType];
    if (!Cls) return;

    const el = new Cls(elementId);

    if (style.fill !== undefined) el.setFill(style.fill as string);
    if (style.stroke !== undefined) el.setStroke(style.stroke as string);
    if (style.strokeWidth !== undefined)
      el.setStrokeWidth(style.strokeWidth as number);
    if (style.opacity !== undefined) el.setOpacity(style.opacity as number);

    if (elementType === 'polyline' || elementType === 'polygon') {
      el.points = geometry.points as string;
    } else {
      Object.assign(el.geometry, geometry);
    }

    el.buildHitArea();

    shapeManager.add(el);
  };
};
