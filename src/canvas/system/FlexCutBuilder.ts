import type { CutSegment } from '@/math/flex-tree';
import { SVG_NS } from '@/constants';

export class FlexCutBuilder {
  public buildClipDef(
    elementId: string,
    elementType: string,
    geometry: Record<string, unknown>,
    scaleX = 1,
    scaleY = 1,
  ): SVGClipPathElement {
    const clipId = `flexcut-${elementId}`;
    const cp = document.createElementNS(SVG_NS, 'clipPath');
    cp.setAttribute('id', clipId);

    let shape: SVGElement;
    switch (elementType) {
      case 'circle': {
        shape = document.createElementNS(SVG_NS, 'circle');
        shape.setAttribute('cx', String(geometry.cx));
        shape.setAttribute('cy', String(geometry.cy));
        shape.setAttribute('r', String(geometry.r));
        break;
      }
      case 'ellipse': {
        shape = document.createElementNS(SVG_NS, 'ellipse');
        shape.setAttribute('cx', String(geometry.cx));
        shape.setAttribute('cy', String(geometry.cy));
        shape.setAttribute('rx', String(geometry.rx));
        shape.setAttribute('ry', String(geometry.ry));
        break;
      }
      case 'polygon':
      case 'polyline': {
        shape = document.createElementNS(SVG_NS, 'polygon');
        shape.setAttribute('points', String(geometry.points ?? ''));
        break;
      }
      case 'path': {
        shape = document.createElementNS(SVG_NS, 'path');
        shape.setAttribute('d', String(geometry.d ?? ''));
        break;
      }
      case 'rect':
      default: {
        shape = document.createElementNS(SVG_NS, 'rect');
        shape.setAttribute('x', String(geometry.x ?? 0));
        shape.setAttribute('y', String(geometry.y ?? 0));
        shape.setAttribute('width', String(geometry.width ?? 0));
        shape.setAttribute('height', String(geometry.height ?? 0));
        break;
      }
    }
    if (scaleX !== 1 || scaleY !== 1) {
      shape.setAttribute('transform', `scale(${scaleX},${scaleY})`);
    }
    cp.appendChild(shape);
    return cp;
  }

  public buildPathD(segments: CutSegment[]): string {
    let d = '';
    for (const s of segments) {
      d += `M${s.x1.toFixed(2)} ${s.y1.toFixed(2)} L${s.x2.toFixed(2)} ${s.y2.toFixed(2)} `;
    }
    return d;
  }

  public createCutPath(d: string, clipId: string): SVGPathElement {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ff0000');
    path.setAttribute('stroke-width', '500');
    path.setAttribute('clip-path', `url(#${clipId})`);
    return path;
  }
}
