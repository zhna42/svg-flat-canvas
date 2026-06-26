import type { Camera } from '@/camera/Camera';
import { SVG_NS, MM_TO_PX } from '@/constants';

export class GridOverlay {
  private readonly group: SVGGElement;
  private readonly getArtboardSize: () => { width: number; height: number };
  private _stepMM = 10;
  private _visible = false;

  public constructor(
    _camera: Camera,
    getArtboardSize: () => { width: number; height: number },
  ) {
    this.getArtboardSize = getArtboardSize;
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('pointer-events', 'none');
  }

  public getElement(): SVGGElement {
    return this.group;
  }

  public get visible(): boolean {
    return this._visible;
  }

  public get stepMM(): number {
    return this._stepMM;
  }

  public setStep(mm: number): void {
    this._stepMM = mm;
    this.redraw();
  }

  public show(): void {
    this._visible = true;
    this.redraw();
  }

  public hide(): void {
    this._visible = false;
    this.group.innerHTML = '';
  }

  public getGridLines(): Array<{
    orientation: 'v' | 'h';
    position: number;
  }> {
    if (!this._visible) return [];
    const step = this._stepMM * MM_TO_PX;
    const { width, height } = this.getArtboardSize();

    const lines: Array<{ orientation: 'v' | 'h'; position: number }> = [];
    for (let x = 0; x <= width; x += step) {
      lines.push({ orientation: 'v', position: x });
    }
    for (let y = 0; y <= height; y += step) {
      lines.push({ orientation: 'h', position: y });
    }
    return lines;
  }

  public redraw(): void {
    this.group.innerHTML = '';
    if (!this._visible) return;

    const step = this._stepMM * MM_TO_PX;
    const { width, height } = this.getArtboardSize();

    let html = '';
    for (let x = 0; x <= width; x += step) {
      html += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#ccc" stroke-width="1" stroke-opacity="0.3" vector-effect="non-scaling-stroke"/>`;
    }
    for (let y = 0; y <= height; y += step) {
      html += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#ccc" stroke-width="1" stroke-opacity="0.3" vector-effect="non-scaling-stroke"/>`;
    }
    this.group.innerHTML = html;
  }

  public destroy(): void {
    this.group.remove();
  }
}
