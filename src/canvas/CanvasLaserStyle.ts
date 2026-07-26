import type { LaserStyleOverride } from '@/modules/laser/laser-types';

export class CanvasLaserStyle {
  _laserStyleProvider: ((id: string) => LaserStyleOverride | null) | null =
    null;
  _baseStyle = new Map<
    string,
    { fill?: string; stroke?: string; strokeWidth?: string; visibility?: string; opacity?: string }
  >();

  readonly _elements: Map<string, SVGElement>;

  constructor(elements: Map<string, SVGElement>) {
    this._elements = elements;
  }

  setLaserStyleProvider(
    fn: (id: string) => LaserStyleOverride | null,
  ): void {
    this._laserStyleProvider = fn;
  }

  captureBase(id: string, diff: Record<string, unknown>): void {
    let base = this._baseStyle.get(id);
    if (!base) {
      base = {};
      this._baseStyle.set(id, base);
    }
    if ('fill' in diff) base.fill = diff.fill as string;
    if ('stroke' in diff) base.stroke = diff.stroke as string;
    if ('stroke-width' in diff)
      base.strokeWidth = diff['stroke-width'] as string;
    if ('visibility' in diff) base.visibility = diff.visibility as string;
    if ('opacity' in diff) base.opacity = diff.opacity as string;
  }

  applyLaser(id: string, element: SVGElement): void {
    const base = this._baseStyle.get(id) ?? {};
    const o = this._laserStyleProvider?.(id) ?? null;

    const fill = o?.fill ?? base.fill;
    if (fill !== undefined) element.setAttribute('fill', fill);

    const stroke = o?.stroke ?? base.stroke;
    if (stroke !== undefined) element.setAttribute('stroke', stroke);

    const strokeWidth = o?.strokeWidth != null
      ? String(o.strokeWidth)
      : base.strokeWidth;
    if (strokeWidth !== undefined)
      element.setAttribute('stroke-width', strokeWidth);

    const visibility = o?.visibility ?? base.visibility;
    if (visibility !== undefined)
      element.setAttribute('visibility', visibility);

    const opacity = o?.opacity != null ? String(o.opacity) : base.opacity;
    if (opacity !== undefined) element.setAttribute('opacity', opacity);
  }

  refresh(ids?: string[]): void {
    const targets = ids ?? Array.from(this._baseStyle.keys());
    for (const id of targets) {
      const el = this._elements.get(id);
      if (el) this.applyLaser(id, el);
    }
  }
}
