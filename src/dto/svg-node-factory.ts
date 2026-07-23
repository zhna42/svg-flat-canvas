import type { SvgNodeDto } from './svg-node-dto';
import { createElementByType } from '@/core/shapes/factory';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { RectElement } from '@/core/shapes/elements/RectElement';
import { CircleElement } from '@/core/shapes/elements/CircleElement';
import { EllipseElement } from '@/core/shapes/elements/EllipseElement';
import { LineElement } from '@/core/shapes/elements/LineElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import { PolygonElement } from '@/core/shapes/elements/PolygonElement';
import { PolylineElement } from '@/core/shapes/elements/PolylineElement';
import { TextElement } from '@/core/shapes/elements/TextElement';
import { ImageElement } from '@/core/shapes/elements/ImageElement';

const createByTag = (id: string, tag: string): AbstractGraphicElement =>
  createElementByType(tag, id) ?? new RectElement(id);

export const svgNodesToElements = (
  dtos: SvgNodeDto[],
): AbstractGraphicElement[] =>
  dtos.map((dto) => {
    const el = createByTag(dto.id, dto.tag);

    for (const [key, value] of Object.entries(dto.properties)) {
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
        continue;
      }
      if (el instanceof PolylineElement && key === 'points') {
        el.points = value;
        continue;
      }
      if (el instanceof TextElement) {
        if (key === 'textContent') {
          const stripped = value.replace(/<[^>]*>/g, '');
          if (stripped.trim()) {
            if (el.textModel.length > 0) {
              el.textModel[0].text = stripped;
            } else {
              el.textModel = [{ ...el.defaultStyle, text: stripped }];
            }
          }
          continue;
        }
        if (key === 'x') {
          el.boxX = parseFloat(value);
          continue;
        }
        if (key === 'y') {
          el.boxY = parseFloat(value);
          continue;
        }
        if (key === 'font-size') {
          if (el.textModel.length > 0) {
            el.textModel[0].fontSize = parseFloat(value);
          } else {
            el.textModel = [
              { ...el.defaultStyle, fontSize: parseFloat(value), text: '' },
            ];
          }
          continue;
        }
        if (key === 'font-family') {
          if (el.textModel.length > 0) {
            el.textModel[0].fontFamily = value;
          }
          continue;
        }
        if (key === 'text-anchor') {
          el.align =
            value === 'middle' ? 'center' : value === 'end' ? 'right' : 'left';
          continue;
        }
      }
      if (el instanceof ImageElement) {
        if (key === 'href') {
          el.href = value;
          continue;
        }
        if (key in el.geometry) {
          (el.geometry as any)[key] = parseFloat(value);
          continue;
        }
      }
      if (key === 'fill') {
        el.style.fill = value;
      } else if (key === 'stroke') {
        el.style.stroke = value;
      } else if (key === 'stroke-width') {
        el.style.strokeWidth = parseFloat(value);
      } else if (key === 'opacity') {
        el.style.opacity = parseFloat(value);
      }
    }

    el.groupId = dto.svgGroupId ?? '';
    el.laserProps.laserGroupId = dto.laserGroupId ?? '';
    el.laserProps.laserType = dto.laserActionType;
    el.name = dto.tag;

    el.rebuildHitArea();
    el.clearTimeMachineDiff();

    return el;
  });

export const toSvgCanvasFormat = (
  dtos: SvgNodeDto[],
): AbstractGraphicElement[] => svgNodesToElements(dtos);
