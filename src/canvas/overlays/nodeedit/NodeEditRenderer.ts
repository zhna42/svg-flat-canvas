import type { EditTarget } from './NodeEditSession';
import type { Point } from '@/core/type';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ACCENT = '#4285f4';
const FILL = '#ffffff';
const LINE_COLOR = '#a0a0a0';

// Базовые экранные размеры (в пикселях), делятся на zoom.
const ANCHOR_PX = 9;
const CTRL_R_PX = 4;
const STROKE_PX = 1500;
const LINE_PX = 1000;

/**
 * Рендерер ручек редактирования узлов. Живёт ВНУТРИ cameraGroup,
 * поэтому позиции задаются в мировых координатах и едут с камерой сами.
 * Размеры пересчитываются как base/zoom, чтобы оставаться постоянными на экране.
 */
export class NodeEditRenderer {
  private root: SVGGElement;
  private lastTargets: EditTarget[] = [];
  private zoom = 1;

  constructor() {
    this.root = document.createElementNS(SVG_NS, 'g');
    this.root.setAttribute('id', 'node-edit-overlay');
    this.root.setAttribute('pointer-events', 'none');
  }

  getElement(): SVGGElement {
    return this.root;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom > 0 ? zoom : 1;
    this.render(this.lastTargets, this.zoom);
  }

  clear(): void {
    this.lastTargets = [];
    while (this.root.firstChild) this.root.firstChild.remove();
  }

  render(targets: EditTarget[], zoom: number): void {
    this.lastTargets = targets;
    this.zoom = zoom > 0 ? zoom : 1;
    while (this.root.firstChild) this.root.firstChild.remove();

    const z = this.zoom;
    const anchor = ANCHOR_PX / z;
    const half = anchor / 2;
    const ctrlR = CTRL_R_PX / z;
    const stroke = STROKE_PX / z;
    const line = LINE_PX / z;

    for (const target of targets) {
      // Линии-«усы» и ручки — только у выбранных узлов.
      for (const contour of target.contours) {
        for (const node of contour.nodes) {
          const selected = target.selection.has(node.id);
          if (selected) {
            if (node.handleIn) {
              this.drawLine(node.anchor, node.handleIn, line);
            }
            if (node.handleOut) {
              this.drawLine(node.anchor, node.handleOut, line);
            }
          }
        }
      }
      // Контрольные точки (поверх линий)
      for (const contour of target.contours) {
        for (const node of contour.nodes) {
          if (!target.selection.has(node.id)) continue;
          if (node.handleIn) this.drawControl(node.handleIn, ctrlR, stroke);
          if (node.handleOut) this.drawControl(node.handleOut, ctrlR, stroke);
        }
      }
      // Якоря (поверх всего)
      for (const contour of target.contours) {
        for (const node of contour.nodes) {
          const selected = target.selection.has(node.id);
          this.drawAnchor(
            target.elementId,
            node.id,
            node.anchor,
            node.type,
            selected,
            half,
            stroke,
          );
        }
      }
    }
  }

  private drawLine(a: Point, b: Point, stroke: number): void {
    const el = document.createElementNS(SVG_NS, 'line');
    el.setAttribute('x1', String(a.x));
    el.setAttribute('y1', String(a.y));
    el.setAttribute('x2', String(b.x));
    el.setAttribute('y2', String(b.y));
    el.setAttribute('stroke', LINE_COLOR);
    el.setAttribute('stroke-width', String(stroke));
    this.root.appendChild(el);
  }

  private drawControl(p: Point, r: number, stroke: number): void {
    const el = document.createElementNS(SVG_NS, 'circle');
    el.setAttribute('cx', String(p.x));
    el.setAttribute('cy', String(p.y));
    el.setAttribute('r', String(r));
    el.setAttribute('fill', FILL);
    el.setAttribute('stroke', ACCENT);
    el.setAttribute('stroke-width', String(stroke));
    this.root.appendChild(el);
  }

  private drawAnchor(
    elementId: string,
    nodeId: string,
    p: Point,
    type: string,
    selected: boolean,
    half: number,
    stroke: number,
  ): void {
    let el: SVGElement;
    if (type === 'corner') {
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', String(p.x - half));
      r.setAttribute('y', String(p.y - half));
      r.setAttribute('width', String(half * 2));
      r.setAttribute('height', String(half * 2));
      el = r;
    } else if (type === 'symmetric') {
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute(
        'points',
        `${p.x},${p.y - half} ${p.x + half},${p.y} ${p.x},${p.y + half} ${p.x - half},${p.y}`,
      );
      el = poly;
    } else {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(p.x));
      c.setAttribute('cy', String(p.y));
      c.setAttribute('r', String(half));
      el = c;
    }
    el.setAttribute('fill', selected ? ACCENT : FILL);
    el.setAttribute('stroke', ACCENT);
    el.setAttribute('stroke-width', String(stroke));
    el.setAttribute('data-element-id', elementId);
    el.setAttribute('data-node-id', nodeId);
    this.root.appendChild(el);
  }
}
