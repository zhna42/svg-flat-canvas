import type { RenderSnapshot } from '@/shapes/elements/AbstractGraphicElement';
import { DirtyFlag } from '@/renderer/RenderQueue';

export const TAG_BY_TYPE: Record<string, string> = {
  rect: 'rect',
  circle: 'circle',
  ellipse: 'ellipse',
  line: 'line',
  polygon: 'polygon',
  polyline: 'polyline',
  path: 'path',
  text: 'text',
  image: 'image',
};

export const applySpecialProperty = (
  element: SVGElement,
  key: string,
  value: unknown,
): boolean => {
  if (key === 'textContent') {
    element.textContent = String(value);
    return true;
  }
  if (key === 'href') {
    element.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'href',
      String(value),
    );
    return true;
  }
  return false;
};

export const applyRenderSnapshot = (
  snapshot: RenderSnapshot,
  element: SVGElement,
  flags: number = DirtyFlag.Transform |
    DirtyFlag.Style |
    DirtyFlag.Geometry |
    DirtyFlag.Visibility,
): void => {
  const { matrix, style, visible } = snapshot;

  if (flags & DirtyFlag.Transform && matrix && matrix.length === 6) {
    const [a, b, c, d, e, f] = matrix;
    if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || e !== 0 || f !== 0) {
      element.setAttribute(
        'transform',
        `matrix(${a},${b},${c},${d},${e},${f})`,
      );
    } else {
      element.removeAttribute('transform');
    }
  }

  if (flags & DirtyFlag.Style) {
    const s = style as Record<string, unknown>;
    if (s.fill !== undefined && s.fill !== '')
      element.setAttribute('fill', s.fill as string);
    else element.removeAttribute('fill');
    if (s.stroke !== undefined && s.stroke !== '')
      element.setAttribute('stroke', s.stroke as string);
    else element.removeAttribute('stroke');
    if (s.strokeWidth !== undefined)
      element.setAttribute('stroke-width', String(s.strokeWidth));
    if (s.opacity !== undefined)
      element.setAttribute('opacity', String(s.opacity));
  }

  if (flags & DirtyFlag.Visibility) {
    element.setAttribute('visibility', visible ? 'visible' : 'hidden');
  }

  if (flags & DirtyFlag.Geometry) {
    for (const [key, value] of Object.entries(snapshot.geometry)) {
      if (value !== undefined) {
        if (!applySpecialProperty(element, key, value)) {
          element.setAttribute(key, String(value));
        }
      }
    }
  }
};
