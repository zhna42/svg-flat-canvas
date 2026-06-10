import { SvgElement } from './SvgElement';
import { MAX_HIT_POINTS } from '@/constants';

export class CircleElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'circle', 'circle');
  }

  public buildHitArea(): void {
    const cx = this.getAttrAsNum('cx', 0);
    const cy = this.getAttrAsNum('cy', 0);
    const r = this.getAttrAsNum('r', 0);

    if (r <= 0) return;

    const points = MAX_HIT_POINTS;
    this._hitArea = [];
    for (let i = 0; i < points; i++) {
      const angle = (2 * Math.PI * i) / points;
      this._hitArea.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    }
  }

  public clone(): CircleElement {
    const el = new CircleElement(this.id);
    [
      'cx',
      'cy',
      'r',
      'fill',
      'stroke',
      'stroke-width',
      'opacity',
      'transform',
    ].forEach((attr) => {
      const v = this.element.getAttribute(attr);
      if (v !== null) el.element.setAttribute(attr, v);
    });
    return el;
  }

  protected createClone(): CircleElement {
    return new CircleElement(this.id);
  }

  private getAttrAsNum(name: string, fallback: number): number {
    const v = this.element.getAttribute(name);
    return v !== null ? parseFloat(v) : fallback;
  }
}
