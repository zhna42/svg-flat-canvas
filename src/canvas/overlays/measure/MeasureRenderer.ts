import type { Point, Measurement } from '@/types';
import type { Camera } from '@/canvas/Camera';
import { distanceMm, angleDeg } from './MeasureSession';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ACCENT = '#f4a742';
const LINE = '#f4a742';
const REF_COLOR = '#4285f4';
const TEXT_BG = 'rgba(20,20,25,0.85)';

export interface MeasureRenderData {
  measurements: Measurement[];
  pending: Point[];
  cursor: Point | null;
  hoverPoints: Point[];
  tool: 'ruler' | 'protractor' | null;
}

/**
 * Рендерер замеров. Screen-space оверлей (вне cameraGroup):
 * позиции считаются через camera.worldToScreen, размеры фиксированы в px.
 */
export class MeasureRenderer {
  private root: SVGGElement;
  private camera: Camera;
  private data: MeasureRenderData = {
    measurements: [],
    pending: [],
    cursor: null,
    hoverPoints: [],
    tool: null,
  };

  constructor(camera: Camera) {
    this.camera = camera;
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('id', 'measure-overlay');
    this.root.setAttribute('pointer-events', 'none');
  }

  getElement(): SVGGElement {
    return this.root;
  }

  setData(data: MeasureRenderData): void {
    this.data = data;
    this.render();
  }

  render(): void {
    while (this.root.firstChild) this.root.firstChild.remove();
    const s = (p: Point): Point => this.camera.worldToScreen(p);

    // Опорные точки при ховере (режим линейки)
    for (const p of this.data.hoverPoints) {
      const sp = s(p);
      this.dot(sp, 3.5, REF_COLOR);
    }

    // Завершённые замеры
    for (const m of this.data.measurements) this.drawMeasurement(m, s);

    // Незавершённый замер + курсор
    if (this.data.pending.length > 0) {
      const pts = this.data.pending.map(s);
      const cursor = this.data.cursor ? s(this.data.cursor) : null;
      const chain = cursor ? [...pts, cursor] : pts;
      for (let i = 0; i < chain.length - 1; i++) {
        this.line(chain[i], chain[i + 1], true);
      }
      for (const p of pts) this.dot(p, 4, ACCENT);

      if (this.data.tool === 'ruler' && this.data.cursor) {
        const mm = distanceMm(this.data.pending[0], this.data.cursor);
        this.label(mid(pts[0], cursor!), `${mm.toFixed(1)} мм`);
      } else if (
        this.data.tool === 'protractor' &&
        this.data.pending.length === 2 &&
        this.data.cursor
      ) {
        const deg = angleDeg(
          this.data.pending[1],
          this.data.pending[0],
          this.data.cursor,
        );
        this.label(s(this.data.pending[1]), `${deg.toFixed(1)}°`);
      }
    }
  }

  private drawMeasurement(m: Measurement, s: (p: Point) => Point): void {
    if (m.kind === 'distance') {
      const a = s(m.a);
      const b = s(m.b);
      this.line(a, b, false);
      this.tick(a, b);
      this.tick(b, a);
      this.dot(a, 3.5, ACCENT);
      this.dot(b, 3.5, ACCENT);
      this.label(mid(a, b), `${distanceMm(m.a, m.b).toFixed(1)} мм`);
    } else {
      const v = s(m.vertex);
      const p1 = s(m.p1);
      const p2 = s(m.p2);
      this.line(v, p1, false);
      this.line(v, p2, false);
      this.arc(v, p1, p2);
      this.dot(v, 4, ACCENT);
      this.label(v, `${angleDeg(m.vertex, m.p1, m.p2).toFixed(1)}°`);
    }
  }

  private line(a: Point, b: Point, dashed: boolean): void {
    const el = document.createElementNS(SVG_NS, 'line');
    el.setAttribute('x1', String(a.x));
    el.setAttribute('y1', String(a.y));
    el.setAttribute('x2', String(b.x));
    el.setAttribute('y2', String(b.y));
    el.setAttribute('stroke', LINE);
    el.setAttribute('stroke-width', '1500');
    if (dashed) el.setAttribute('stroke-dasharray', '4000 3000');
    this.root.appendChild(el);
  }

  private tick(at: Point, towards: Point): void {
    const dx = towards.x - at.x;
    const dy = towards.y - at.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const el = document.createElementNS(SVG_NS, 'line');
    el.setAttribute('x1', String(at.x - nx * 5000));
    el.setAttribute('y1', String(at.y - ny * 5000));
    el.setAttribute('x2', String(at.x + nx * 5000));
    el.setAttribute('y2', String(at.y + ny * 5000));
    el.setAttribute('stroke', LINE);
    el.setAttribute('stroke-width', '1500');
    this.root.appendChild(el);
  }

  private arc(v: Point, p1: Point, p2: Point): void {
    const r = 26000;
    const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
    let a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    a2 = a1 + delta;
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta > 0 ? 1 : 0;
    const sx = v.x + r * Math.cos(a1);
    const sy = v.y + r * Math.sin(a1);
    const ex = v.x + r * Math.cos(a2);
    const ey = v.y + r * Math.sin(a2);
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute(
      'd',
      `M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`,
    );
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', LINE);
    el.setAttribute('stroke-width', '1500');
    this.root.appendChild(el);
  }

  private dot(p: Point, r: number, color: string): void {
    const el = document.createElementNS(SVG_NS, 'circle');
    el.setAttribute('cx', String(p.x));
    el.setAttribute('cy', String(p.y));
    el.setAttribute('r', String(r));
    el.setAttribute('fill', '#fff');
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', '1500');
    this.root.appendChild(el);
  }

  private label(at: Point, text: string): void {
    const padX = 5;
    const padY = 3;
    const w = text.length * 7 + padX * 2;
    const h = 16;
    const x = at.x + 8;
    const y = at.y - h - 4;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', '3');
    rect.setAttribute('fill', TEXT_BG);
    this.root.appendChild(rect);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', String(x + padX));
    t.setAttribute('y', String(y + h - padY - 1));
    t.setAttribute('fill', '#fff');
    t.setAttribute('font-size', '11');
    t.setAttribute('font-family', 'monospace');
    t.textContent = text;
    this.root.appendChild(t);
  }

  clear(): void {
    this.data = {
      measurements: this.data.measurements,
      pending: [],
      cursor: null,
      hoverPoints: [],
      tool: this.data.tool,
    };
    this.render();
  }
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
