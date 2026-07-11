import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { Camera } from '@/canvas/Camera';
import type {
  GuidelineData,
  ElementType,
  CreationElementType,
} from '@/core/type';
import { MM_TO_PX } from '@/constants';
import { DebugLog } from '@/canvas/overlays/debug/DebugLog';

export class CanvasController {
  private readonly canvas: SvgCanvas;
  private readonly dbg = new DebugLog();

  public constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  public getCanvasSize(): {
    widthMM: number;
    heightMM: number;
    widthPx: number;
    heightPx: number;
    pxPerMM: number;
  } {
    this.dbg.log('API', 'getCanvasSize');
    const artboard = this.canvas.artboard;
    const wMM = artboard.widthMM;
    const hMM = artboard.heightMM;
    return {
      widthMM: wMM,
      heightMM: hMM,
      widthPx: wMM * MM_TO_PX,
      heightPx: hMM * MM_TO_PX,
      pxPerMM: MM_TO_PX,
    };
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    this.canvas.artboard?.setSize(widthMM, heightMM);
    const wUnits = widthMM * MM_TO_PX;
    const hUnits = heightMM * MM_TO_PX;
    this.canvas.svg.setAttribute('viewBox', `0 0 ${wUnits} ${hUnits}`);
    const ctm = this.canvas.svg.getScreenCTM();
    let realW = wUnits;
    let realH = hUnits;
    if (ctm) {
      const rect = this.canvas.svg.getBoundingClientRect();
      const inv = ctm.inverse();
      const p = this.canvas.svg.createSVGPoint();
      p.x = rect.width;
      p.y = rect.height;
      const vp = p.matrixTransform(inv);
      realW = vp.x;
      realH = vp.y;
    }
    this.canvas.camera.fitToViewport(wUnits, hUnits, realW, realH, 40);
    if (this.canvas.rulers.flipY) {
      this.canvas.rulers.setFlipY(true, hUnits);
    }
    this.canvas.events.emit('artboard-resized', { widthMM, heightMM });
  }

  public getCamera(): Camera {
    return this.canvas.camera as any;
  }

  public setPanMode(enabled: boolean): void {
    this.dbg.log('API', 'setPanMode', { enabled });
    this.canvas.panActive.value = enabled;
    if (enabled) {
      this.canvas.creationHandler.setActiveType(null);
    }
    this.canvas.events.emit('SVG_CAD_PAN_MODE_CHANGED', { enabled });
  }

  public setPanHeld(held: boolean): void {
    this.canvas.camera.panHeld = held;
  }

  public setActiveCreationTool(type: ElementType | null): void {
    this.dbg.log('API', 'setActiveCreationTool', { type });
    if (type !== null) {
      this.canvas.panActive.value = false;
    }
    const allowed: ElementType[] = [
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'path',
      'text',
    ];
    if (type === null || (allowed as string[]).includes(type)) {
      this.canvas.creationHandler.setActiveType(
        type as CreationElementType | null,
      );
    }
  }

  public setMode(mode: 'edit' | 'layers'): void {
    this.canvas.setMode(mode);
  }

  public getMode(): 'edit' | 'layers' {
    return this.canvas.mode;
  }

  public showPreloader(): void {
    if (this.canvas.preloaderOverlay.visible) return;
    const vb = this.canvas.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    this.canvas.preloaderOverlay.showCentered(parts[2] || 800, parts[3] || 600);
    this.canvas.events.emit('preloader-toggled', { visible: true });
  }

  public hidePreloader(): void {
    if (!this.canvas.preloaderOverlay.visible) return;
    this.canvas.preloaderOverlay.hide();
    this.canvas.events.emit('preloader-toggled', { visible: false });
  }

  public isPreloaderVisible(): boolean {
    return this.canvas.preloaderOverlay.visible;
  }

  public showGrid(): void {
    if (this.canvas.gridOverlay.visible) return;
    this.canvas.gridOverlay.show();
    this.canvas.events.emit('grid-toggled', { visible: true });
  }

  public hideGrid(): void {
    if (!this.canvas.gridOverlay.visible) return;
    this.canvas.gridOverlay.hide();
    this.canvas.events.emit('grid-toggled', { visible: false });
  }

  public isGridVisible(): boolean {
    return this.canvas.gridOverlay.visible;
  }

  public setGridStep(mm: number): void {
    this.canvas.gridOverlay.setStep(mm);
    this.canvas.events.emit('grid-step-changed', { stepMM: mm });
  }

  public getGridStep(): number {
    return this.canvas.gridOverlay.stepMM;
  }

  public setRulersVisible(v: boolean): void {
    this.canvas.rulers.setVisible(v);
    this.canvas.guidelineManager.setRulersVisible(v);
  }

  public getRulersVisible(): boolean {
    return this.canvas.rulers.visible;
  }

  public setRulerFlipY(flip: boolean): void {
    const hPx = this.canvas.artboard.heightPx;
    this.canvas.rulers.setFlipY(flip, hPx);
  }

  public getRulerFlipY(): boolean {
    return this.canvas.rulers.flipY;
  }

  public addGuideline(orientation: 'v' | 'h', position: number): string {
    return this.canvas.guidelineManager.addGuideline(orientation, position);
  }

  public removeGuideline(id: string): void {
    this.canvas.guidelineManager.removeGuideline(id);
  }

  public getGuidelines(): GuidelineData[] {
    return this.canvas.guidelineManager.getGuidelines();
  }

  public setGuidelinesVisible(orientation: 'v' | 'h', v: boolean): void {
    this.canvas.guidelineManager.setGuidelinesVisible(orientation, v);
  }

  public getGuidelinesVisible(orientation: 'v' | 'h'): boolean {
    return this.canvas.guidelineManager.getGuidelinesVisible(orientation);
  }

  public setDebugMode(enabled: boolean): void {
    this.dbg.setEnabled(enabled);
  }

  _debugShowHitArea = false;

  public get debugShowHitArea(): boolean {
    return this._debugShowHitArea;
  }
  public set debugShowHitArea(v: boolean) {
    this._debugShowHitArea = v;
    this.canvas.debugOverlay.update(v ? this.canvas.shapeManager.getAll() : []);
  }

}
