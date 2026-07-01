import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

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

const applySpecialProperty = (
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

export const applyElementToDOM = (
  el: AbstractGraphicElement,
  node: SVGElement,
): void => {
  node.setAttribute('visibility', el.visible ? 'visible' : 'hidden');

  const m = el.transform.matrix;
  if (
    m.a !== 1 ||
    m.b !== 0 ||
    m.c !== 0 ||
    m.d !== 1 ||
    m.e !== 0 ||
    m.f !== 0
  ) {
    node.setAttribute(
      'transform',
      `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`,
    );
  } else {
    node.removeAttribute('transform');
  }

  if (el.style.fill && el.style.fill !== '')
    node.setAttribute('fill', el.style.fill);
  else node.removeAttribute('fill');
  if (el.style.stroke && el.style.stroke !== '')
    node.setAttribute('stroke', el.style.stroke);
  else node.removeAttribute('stroke');
  node.setAttribute('stroke-width', String(el.style.strokeWidth));
  node.setAttribute('opacity', String(el.style.opacity));

  const geom = el.getRenderGeometry();
  for (const [key, value] of Object.entries(geom)) {
    if (value !== undefined) {
      if (!applySpecialProperty(node, key, value)) {
        node.setAttribute(key, String(value));
      }
    }
  }
};
