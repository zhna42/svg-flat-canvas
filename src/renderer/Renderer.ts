import { SVG_NS } from '@/constants';
import { Camera } from '@/camera/Camera';
import { Background } from './Background';
import { Artboard } from './Artboard';
import { RenderQueue } from './RenderQueue';
import { setRenderQueue } from '@/utils/render-queue-utils';
import { TAG_BY_TYPE, applyRenderSnapshot } from '@/utils/render-utils';

export class Renderer {
  private readonly svg: SVGSVGElement;
  private readonly defs: SVGDefsElement;
  private readonly cameraGroup: SVGGElement;
  private readonly shapesGroup: SVGGElement;
  private readonly previewGroup: SVGGElement;
  private readonly camera: Camera;
  private readonly artboard: Artboard;
  private readonly background: Background;
  private readonly queue: RenderQueue;
  private readonly nodeMap = new Map<string, SVGElement>();
  private readonly previewNodeMap = new Map<string, SVGElement>();

  private rafId: number | null = null;

  public constructor(svg: SVGSVGElement, camera: Camera) {
    this.svg = svg;
    this.camera = camera;
    this.queue = new RenderQueue();
    setRenderQueue(this.queue);

    const ns = SVG_NS;
    this.defs = document.createElementNS(ns, 'defs');
    this.svg.appendChild(this.defs);

    this.background = new Background();
    this.bootstrapBackgroundDom();

    this.cameraGroup = document.createElementNS(ns, 'g');
    this.svg.appendChild(this.cameraGroup);

    this.shapesGroup = document.createElementNS(ns, 'g');
    this.cameraGroup.appendChild(this.shapesGroup);

    this.previewGroup = document.createElementNS(ns, 'g');
    this.cameraGroup.appendChild(this.previewGroup);

    this.artboard = new Artboard();
    this.bootstrapArtboardDom();
    this.startLoop();
  }

  public getCameraGroup(): SVGGElement {
    return this.cameraGroup;
  }
  public getArtboard(): Artboard {
    return this.artboard;
  }
  public getQueue(): RenderQueue {
    return this.queue;
  }

  public addElement(id: string, type: string): SVGElement {
    const tag = TAG_BY_TYPE[type] || 'rect';
    const el = document.createElementNS(SVG_NS, tag);
    this.nodeMap.set(id, el);
    this.shapesGroup.appendChild(el);
    return el;
  }

  public addPreviewElement(id: string, type: string): SVGElement {
    const tag = TAG_BY_TYPE[type] || 'rect';
    const el = document.createElementNS(SVG_NS, tag);
    this.previewNodeMap.set(id, el);
    el.setAttribute('pointer-events', 'none');
    this.previewGroup.appendChild(el);
    return el;
  }

  public removeElement(id: string): void {
    const el = this.nodeMap.get(id);
    if (el) {
      this.shapesGroup.removeChild(el);
      this.nodeMap.delete(id);
    }
  }

  public moveElementBefore(id: string, beforeId: string): void {
    const el = this.nodeMap.get(id);
    const before = this.nodeMap.get(beforeId);
    if (el && before) {
      this.shapesGroup.insertBefore(el, before);
    }
  }

  public moveElementAfter(id: string, afterId: string): void {
    const el = this.nodeMap.get(id);
    const after = this.nodeMap.get(afterId);
    if (el && after) {
      this.shapesGroup.insertBefore(el, after.nextSibling);
    }
  }

  public removePreviewElement(id: string): void {
    const el = this.previewNodeMap.get(id);
    if (el) {
      this.previewGroup.removeChild(el);
      this.previewNodeMap.delete(id);
    }
  }

  public clear(): void {
    for (const [, el] of this.nodeMap) {
      this.cameraGroup.removeChild(el);
    }
    this.nodeMap.clear();
  }

  public getNode(id: string): SVGElement | undefined {
    return this.nodeMap.get(id);
  }

  public destroy(): void {
    setRenderQueue(null);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private bootstrapBackgroundDom(): void {
    const bg = this.background;
    const p = bg.pattern;

    const patternNode = document.createElementNS(SVG_NS, 'pattern');
    patternNode.id = p.id;
    patternNode.setAttribute('width', String(p.geometry.width));
    patternNode.setAttribute('height', String(p.geometry.height));
    patternNode.setAttribute('patternUnits', p.geometry.patternUnits);

    const bgRect = document.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('width', String(p.geometry.width));
    bgRect.setAttribute('height', String(p.geometry.height));
    bgRect.setAttribute('fill', '#f0f0f0');
    patternNode.appendChild(bgRect);

    for (const cell of p.cells) {
      const cellNode = document.createElementNS(SVG_NS, 'rect');
      cellNode.setAttribute('x', String(cell.x));
      cellNode.setAttribute('y', String(cell.y));
      cellNode.setAttribute('width', String(cell.width));
      cellNode.setAttribute('height', String(cell.height));
      cellNode.setAttribute('fill', cell.fill);
      patternNode.appendChild(cellNode);
    }

    this.defs.appendChild(patternNode);

    const fillNode = document.createElementNS(SVG_NS, 'rect');
    fillNode.setAttribute('pointer-events', 'none');
    this.svg.insertBefore(fillNode, this.svg.firstChild);
    this.nodeMap.set('bg-fill', fillNode);

    applyRenderSnapshot(bg.fillRect.getRenderSnapshot(), fillNode);
  }

  private bootstrapArtboardDom(): void {
    const artboardNode = document.createElementNS(SVG_NS, 'rect');
    artboardNode.setAttribute('pointer-events', 'none');
    this.cameraGroup.insertBefore(artboardNode, this.shapesGroup);
    this.nodeMap.set('artboard', artboardNode);

    applyRenderSnapshot(this.artboard.rect.getRenderSnapshot(), artboardNode);
  }

  private startLoop(): void {
    const tick = (): void => {
      if (this.camera.dirty) {
        this.cameraGroup.setAttribute('transform', this.camera.getTransform());
        this.camera.markClean();
      }

      if (this.artboard.dirty) {
        const node = this.nodeMap.get('artboard');
        if (node) {
          applyRenderSnapshot(this.artboard.rect.getRenderSnapshot(), node);
        }
        this.artboard.markClean();
      }

      const pending = this.queue.drain();
      for (const entry of pending) {
        let node = this.nodeMap.get(entry.element.id);
        if (!node) node = this.previewNodeMap.get(entry.element.id);
        if (!node) continue;
        applyRenderSnapshot(
          entry.element.getRenderSnapshot(),
          node,
          entry.flags,
        );
        entry.element.markClean();
      }

      const overlayPending = this.queue.drainOverlays();
      for (const overlay of overlayPending) {
        overlay.flushToDOM();
      }

      const drainables = this.queue.drainDrainables();
      for (const d of drainables) {
        d.flushToDOM();
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
