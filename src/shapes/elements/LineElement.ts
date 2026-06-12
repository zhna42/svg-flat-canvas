import { SvgElement } from './SvgElement';
import { MIN_HIT_STROKE_WIDTH } from '@/constants';

export class LineElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'line', 'line');
  }

  public buildHitArea(): void {
    const x1 = this.getAttrAsNum('x1', 0);
    const y1 = this.getAttrAsNum('y1', 0);
    const x2 = this.getAttrAsNum('x2', 0);
    const y2 = this.getAttrAsNum('y2', 0);

    const sw = Math.max(this.getStrokeWidth(), MIN_HIT_STROKE_WIDTH);
    const halfSw = sw / 2;

    if (x1 === x2 && y1 === y2) {
      this._hitArea = [
        { x: x1 - halfSw, y: y1 - halfSw },
        { x: x1 + halfSw, y: y1 - halfSw },
        { x: x1 + halfSw, y: y1 + halfSw },
        { x: x1 - halfSw, y: y1 + halfSw },
      ];
      return;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = (-dy / len) * halfSw;
    const ny = (dx / len) * halfSw;

    this._hitArea = [
      { x: x1 + nx, y: y1 + ny },
      { x: x2 + nx, y: y2 + ny },
      { x: x2 - nx, y: y2 - ny },
      { x: x1 - nx, y: y1 - ny },
    ];
  }

  public clone(): LineElement {
    const el = new LineElement(this.id);
    [
      'x1',
      'y1',
      'x2',
      'y2',
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

  protected createClone(): LineElement {
    return new LineElement(this.id);
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    const x1 = this.getAttrAsNum('x1', 0) + dx;
    const y1 = this.getAttrAsNum('y1', 0) + dy;
    const x2 = this.getAttrAsNum('x2', 0) + dx;
    const y2 = this.getAttrAsNum('y2', 0) + dy;
    this.element.setAttribute('x1', String(x1));
    this.element.setAttribute('y1', String(y1));
    this.element.setAttribute('x2', String(x2));
    this.element.setAttribute('y2', String(y2));
  }
}
