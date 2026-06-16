import type { Camera } from '@/camera/Camera';
import { SVG_NS } from '@/constants';

export interface RectOverlay {
  element: SVGRectElement | null;
}

export interface LassoOverlay {
  element: SVGPolylineElement | null;
}

export const createRectOverlay = (
  overlayRoot: SVGGElement,
  _camera: Camera,
  screenX: number,
  screenY: number,
): RectOverlay => {
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('fill', 'rgba(66, 133, 244, 0.12)');
  rect.setAttribute('stroke', '#4285f4');
  rect.setAttribute('stroke-width', '1');
  rect.setAttribute('pointer-events', 'none');
  rect.setAttribute('x', String(screenX));
  rect.setAttribute('y', String(screenY));
  rect.setAttribute('width', '0');
  rect.setAttribute('height', '0');
  overlayRoot.appendChild(rect);
  return { element: rect };
};

export const updateRectOverlay = (
  overlay: RectOverlay,
  r: { x: number; y: number; w: number; h: number },
  leftToRight: boolean,
  _camera: Camera,
): void => {
  if (!overlay.element) return;
  if (leftToRight) {
    overlay.element.setAttribute('fill', 'rgba(200, 120, 0, 0.12)');
    overlay.element.setAttribute('stroke', '#c87800');
  } else {
    overlay.element.setAttribute('fill', 'rgba(66, 133, 244, 0.12)');
    overlay.element.setAttribute('stroke', '#4285f4');
  }
  overlay.element.setAttribute('x', String(r.x));
  overlay.element.setAttribute('y', String(r.y));
  overlay.element.setAttribute('width', String(r.w));
  overlay.element.setAttribute('height', String(r.h));
};

export const hideRectOverlay = (overlay: RectOverlay): void => {
  if (overlay.element) {
    overlay.element.remove();
    overlay.element = null;
  }
};

export const createLassoOverlay = (
  overlayRoot: SVGGElement,
  _camera: Camera,
): LassoOverlay => {
  const poly = document.createElementNS(SVG_NS, 'polyline');
  poly.setAttribute('fill', 'rgba(255, 165, 0, 0.1)');
  poly.setAttribute('stroke', '#ff8c00');
  poly.setAttribute('stroke-width', '1.5');
  poly.setAttribute('stroke-dasharray', '3 2');
  poly.setAttribute('pointer-events', 'none');
  poly.setAttribute('stroke-linejoin', 'round');
  overlayRoot.appendChild(poly);
  return { element: poly };
};

export const updateLassoOverlay = (
  overlay: LassoOverlay,
  points: readonly { x: number; y: number }[],
): void => {
  if (!overlay.element) return;
  const str = points.map((p) => `${p.x},${p.y}`).join(' ');
  overlay.element.setAttribute('points', str);
};

export const hideLassoOverlay = (overlay: LassoOverlay): void => {
  if (overlay.element) {
    overlay.element.remove();
    overlay.element = null;
  }
};
