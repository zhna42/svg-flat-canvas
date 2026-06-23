import type { Point } from '@/types';
import { MIN_HIT_STROKE_WIDTH } from '@/constants';
import {
  approximateArc,
  offsetPolygon,
  offsetOpenPath,
} from '@/spatial/geometry-utils';

export abstract class HitArea {
  protected _points: Point[] = [];

  public abstract build(): void;

  public get points(): Point[] {
    if (this._points.length === 0) this.build();
    return this._points;
  }

  public invalidate(): void {
    this._points = [];
  }

  protected getStrokeWidthOffset(
    strokeWidth: number,
    hasFill: boolean,
  ): number {
    if (hasFill) return 0;
    return Math.max(strokeWidth, MIN_HIT_STROKE_WIDTH) / 2;
  }
}

export class RectHitArea extends HitArea {
  private x = 0;
  private y = 0;
  private w = 0;
  private h = 0;
  private rx = 0;
  private ry = 0;
  private sw = 0;
  private fill = false;

  public set(
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
    sw: number,
    fill: boolean,
  ): void {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.rx = rx;
    this.ry = ry;
    this.sw = sw;
    this.fill = fill;
    this.invalidate();
  }

  public build(): void {
    if (this.w <= 0 || this.h <= 0) return;
    if (!this.fill || this.rx > 0 || this.ry > 0) {
      const rX = Math.min(this.rx || this.ry, this.w / 2);
      const rY = Math.min(this.ry || this.rx, this.h / 2);
      const offset = this.getStrokeWidthOffset(this.sw, this.fill);
      const pts = approximateArc(rX + offset, rY + offset, 16);
      const n = pts.length;
      const cx = this.x + this.w / 2,
        cy = this.y + this.h / 2;
      const innerW = this.w / 2 - rX,
        innerH = this.h / 2 - rY;
      const result: Point[] = [];
      for (let i = 0; i < n; i++)
        result.push({ x: cx + pts[i].x + innerW, y: cy + pts[i].y + innerH });
      for (let i = 0; i < n; i++)
        result.push({
          x: cx - pts[n - 1 - i].x - innerW,
          y: cy + pts[n - 1 - i].y + innerH,
        });
      for (let i = 0; i < n; i++)
        result.push({ x: cx - pts[i].x - innerW, y: cy - pts[i].y - innerH });
      for (let i = 0; i < n; i++)
        result.push({
          x: cx + pts[n - 1 - i].x + innerW,
          y: cy - pts[n - 1 - i].y - innerH,
        });
      this._points = result;
      return;
    }
    this._points = [
      { x: this.x, y: this.y },
      { x: this.x + this.w, y: this.y },
      { x: this.x + this.w, y: this.y + this.h },
      { x: this.x, y: this.y + this.h },
    ];
  }
}

export class CircleHitArea extends HitArea {
  private cx = 0;
  private cy = 0;
  private r = 0;

  public set(cx: number, cy: number, r: number): void {
    this.cx = cx;
    this.cy = cy;
    this.r = r;
    this.invalidate();
  }

  public build(): void {
    if (this.r <= 0) return;
    const pts: Point[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (2 * Math.PI * i) / 16;
      pts.push({
        x: this.cx + this.r * Math.cos(a),
        y: this.cy + this.r * Math.sin(a),
      });
    }
    this._points = pts;
  }
}

export class EllipseHitArea extends HitArea {
  private cx = 0;
  private cy = 0;
  private rx = 0;
  private ry = 0;

  public set(cx: number, cy: number, rx: number, ry: number): void {
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.ry = ry;
    this.invalidate();
  }

  public build(): void {
    if (this.rx <= 0 || this.ry <= 0) return;
    const pts: Point[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (2 * Math.PI * i) / 16;
      pts.push({
        x: this.cx + this.rx * Math.cos(a),
        y: this.cy + this.ry * Math.sin(a),
      });
    }
    this._points = pts;
  }
}

export class LineHitArea extends HitArea {
  private x1 = 0;
  private y1 = 0;
  private x2 = 0;
  private y2 = 0;
  private sw = 0;

  public set(x1: number, y1: number, x2: number, y2: number, sw: number): void {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.sw = sw;
    this.invalidate();
  }

  public build(): void {
    const halfSw = Math.max(this.sw, MIN_HIT_STROKE_WIDTH) / 2;
    if (this.x1 === this.x2 && this.y1 === this.y2) {
      this._points = [
        { x: this.x1 - halfSw, y: this.y1 - halfSw },
        { x: this.x1 + halfSw, y: this.y1 - halfSw },
        { x: this.x1 + halfSw, y: this.y1 + halfSw },
        { x: this.x1 - halfSw, y: this.y1 + halfSw },
      ];
      return;
    }
    const dx = this.x2 - this.x1,
      dy = this.y2 - this.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = (-dy / len) * halfSw,
      ny = (dx / len) * halfSw;
    this._points = [
      { x: this.x1 + nx, y: this.y1 + ny },
      { x: this.x2 + nx, y: this.y2 + ny },
      { x: this.x2 - nx, y: this.y2 - ny },
      { x: this.x1 - nx, y: this.y1 - ny },
    ];
  }
}

export class PolygonHitArea extends HitArea {
  private rawPoints: Point[] = [];
  private sw = 0;
  private fill = false;

  public set(pts: Point[], sw: number, fill: boolean): void {
    this.rawPoints = pts;
    this.sw = sw;
    this.fill = fill;
    this.invalidate();
  }

  public build(): void {
    if (this.rawPoints.length < 3) return;
    this._points = this.fill
      ? this.rawPoints
      : offsetPolygon(
          this.rawPoints,
          Math.max(this.sw, MIN_HIT_STROKE_WIDTH) / 2,
        );
  }
}

export class PolylineHitArea extends HitArea {
  private rawPoints: Point[] = [];
  private sw = 0;

  public set(pts: Point[], sw: number): void {
    this.rawPoints = pts;
    this.sw = sw;
    this.invalidate();
  }

  public build(): void {
    if (this.rawPoints.length < 2) return;
    this._points = offsetOpenPath(
      this.rawPoints,
      Math.max(this.sw, MIN_HIT_STROKE_WIDTH) / 2,
    );
  }
}

export class PathHitArea extends HitArea {
  private flat: Point[] = [];
  private sw = 0;
  private fill = false;
  private closed = false;

  public set(flat: Point[], sw: number, fill: boolean, closed: boolean): void {
    this.flat = flat;
    this.sw = sw;
    this.fill = fill;
    this.closed = closed;
    this.invalidate();
  }

  public build(): void {
    if (this.flat.length === 0) return;
    const offset = this.getStrokeWidthOffset(this.sw, this.fill);
    if (offset === 0) {
      this._points = this.flat;
      return;
    }
    this._points = this.closed
      ? offsetPolygon(this.flat, offset)
      : offsetOpenPath(this.flat, offset);
  }
}

export class RectHitAreaSimple extends HitArea {
  private pts: Point[] = [];

  public set(pts: Point[]): void {
    this.pts = pts;
    this.invalidate();
  }

  public build(): void {
    this._points = this.pts;
  }
}
