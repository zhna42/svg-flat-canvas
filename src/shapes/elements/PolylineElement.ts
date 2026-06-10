import { SvgElement } from './SvgElement';
import type { Point } from '@/types';
import { MIN_HIT_STROKE_WIDTH } from '@/constants';

export class PolylineElement extends SvgElement {
  public constructor(id: string) {
    super(id, 'polyline', 'polyline');
  }

  public buildHitArea(): void {
    const pointsAttr = this.element.getAttribute('points') || '';
    const rawPoints = this.parsePoints(pointsAttr);

    if (rawPoints.length < 2) return;

    const sw = Math.max(this.getStrokeWidth(), MIN_HIT_STROKE_WIDTH);
    const halfSw = sw / 2;

    const left: Point[] = [];
    const right: Point[] = [];

    const dir = (ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return { dx: 0, dy: 0 };
      return { dx: dx / len, dy: dy / len };
    };

    const perp = (ax: number, ay: number, bx: number, by: number) => {
      const d = dir(ax, ay, bx, by);
      return { nx: -d.dy * halfSw, ny: d.dx * halfSw };
    };

    const miter = (p: Point, pnx: number, pny: number, nnx: number, nny: number) => {
      const mx = (pnx + nnx) / 2;
      const my = (pny + nny) / 2;
      const len = Math.sqrt(mx * mx + my * my);
      if (len === 0) return { x: p.x + pnx, y: p.y + pny };
      const scale = halfSw / len;
      return { x: p.x + mx * scale, y: p.y + my * scale };
    };

    // start butt cap
    const startDir = dir(rawPoints[0].x, rawPoints[0].y, rawPoints[1].x, rawPoints[1].y);
    const startN = { nx: -startDir.dy * halfSw, ny: startDir.dx * halfSw };
    left.push(
      { x: rawPoints[0].x + startN.nx - startDir.dx * halfSw, y: rawPoints[0].y + startN.ny - startDir.dy * halfSw },
    );
    left.push({ x: rawPoints[0].x + startN.nx, y: rawPoints[0].y + startN.ny });

    // middle points — miter join
    for (let i = 1; i < rawPoints.length - 1; i++) {
      const pn = perp(rawPoints[i - 1].x, rawPoints[i - 1].y, rawPoints[i].x, rawPoints[i].y);
      const nn = perp(rawPoints[i].x, rawPoints[i].y, rawPoints[i + 1].x, rawPoints[i + 1].y);
      left.push(miter(rawPoints[i], pn.nx, pn.ny, nn.nx, nn.ny));
    }

    // end point
    const endDir = dir(rawPoints[rawPoints.length - 2].x, rawPoints[rawPoints.length - 2].y, rawPoints[rawPoints.length - 1].x, rawPoints[rawPoints.length - 1].y);
    const endN = { nx: -endDir.dy * halfSw, ny: endDir.dx * halfSw };
    left.push({ x: rawPoints[rawPoints.length - 1].x + endN.nx, y: rawPoints[rawPoints.length - 1].y + endN.ny });

    // end butt cap
    right.push({ x: rawPoints[rawPoints.length - 1].x + endDir.dx * halfSw - endN.nx, y: rawPoints[rawPoints.length - 1].y + endDir.dy * halfSw - endN.ny });
    right.push({ x: rawPoints[rawPoints.length - 1].x - endN.nx, y: rawPoints[rawPoints.length - 1].y - endN.ny });

    for (let i = rawPoints.length - 2; i >= 1; i--) {
      const pn = perp(rawPoints[i - 1].x, rawPoints[i - 1].y, rawPoints[i].x, rawPoints[i].y);
      const nn = perp(rawPoints[i].x, rawPoints[i].y, rawPoints[i + 1].x, rawPoints[i + 1].y);
      right.push(miter(rawPoints[i], -pn.nx, -pn.ny, -nn.nx, -nn.ny));
    }

    right.push({ x: rawPoints[0].x - startN.nx, y: rawPoints[0].y - startN.ny });
    right.push({ x: rawPoints[0].x - startDir.dx * halfSw - startN.nx, y: rawPoints[0].y - startDir.dy * halfSw - startN.ny });

    this._hitArea = [...left, ...right];
  }

  public clone(): PolylineElement {
    const el = new PolylineElement(this.id);
    [
      'points',
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

  protected createClone(): PolylineElement {
    return new PolylineElement(this.id);
  }

  private parsePoints(points: string): Point[] {
    const nums = points
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));

    const result: Point[] = [];
    for (let i = 0; i < nums.length - 1; i += 2) {
      result.push({ x: nums[i], y: nums[i + 1] });
    }
    return result;
  }
}
