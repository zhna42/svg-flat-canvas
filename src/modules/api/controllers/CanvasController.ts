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

  private _getRealViewportSize(fallbackW: number, fallbackH: number): { w: number; h: number } {
    const ctm = this.canvas.svg.getScreenCTM();
    if (!ctm) {
      console.log('[getRealViewportSize] CTM null, fallback:', { w: fallbackW, h: fallbackH });
      return { w: fallbackW, h: fallbackH };
    }
    const rect = this.canvas.svg.getBoundingClientRect();
    const inv = ctm.inverse();
    const p0 = this.canvas.svg.createSVGPoint();
    p0.x = rect.left;
    p0.y = rect.top;
    const p1 = this.canvas.svg.createSVGPoint();
    p1.x = rect.left + rect.width;
    p1.y = rect.top + rect.height;
    const v0 = p0.matrixTransform(inv);
    const v1 = p1.matrixTransform(inv);
    const result = { w: v1.x - v0.x, h: v1.y - v0.y };
    console.log('[getRealViewportSize]', {
      cssRect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height },
      ctm: { a: ctm.a, d: ctm.d, e: ctm.e, f: ctm.f },
      v0: { x: v0.x, y: v0.y },
      v1: { x: v1.x, y: v1.y },
      result
    });
    return result;
  }

  private _getScaleFactor(): number {
    const ctm = this.canvas.svg.getScreenCTM();
    const scale = ctm ? Math.abs(ctm.a) || 1 : 1;
    console.log('[getScaleFactor]', { ctmA: ctm?.a, ctmD: ctm?.d, scale });
    return scale;
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    this.canvas.artboard?.setSize(widthMM, heightMM);
    const wUnits = widthMM * MM_TO_PX;
    const hUnits = heightMM * MM_TO_PX;
    this.canvas.svg.setAttribute('viewBox', `0 0 ${wUnits} ${hUnits}`);
    const { w: realW, h: realH } = this._getRealViewportSize(wUnits, hUnits);
    const paddingSvg = 40 / this._getScaleFactor();
    this.canvas.camera.fitToViewport(wUnits, hUnits, realW, realH, paddingSvg);
    if (this.canvas.rulers.flipY) {
      this.canvas.rulers.setFlipY(true, hUnits);
    }
    this.canvas.events.emit('artboard-resized', { widthMM, heightMM });
  }

  public setArtboardCenter(padding = 40): void {
    const wUnits = this.canvas.artboard.widthPx;
    const hUnits = this.canvas.artboard.heightPx;
    const { w: realW, h: realH } = this._getRealViewportSize(wUnits, hUnits);
    const scale = this._getScaleFactor();
    const paddingSvg = padding / scale;
    console.log('[setArtboardCenter]', {
      artboard: { w: wUnits, h: hUnits },
      viewport: { w: realW, h: realH },
      cssPadding: padding,
      scale,
      paddingSvg,
      cameraBefore: { x: this.canvas.camera.x, y: this.canvas.camera.y, zoom: this.canvas.camera.zoom }
    });
    this.canvas.camera.fitToViewport(wUnits, hUnits, realW, realH, paddingSvg);
    console.log('[setArtboardCenter] after fitToViewport:', {
      cameraAfter: { x: this.canvas.camera.x, y: this.canvas.camera.y, zoom: this.canvas.camera.zoom }
    });
  }

  public getCamera(): Camera {
    return this.canvas.camera;
  }

  public setPanMode(enabled: boolean): void {
    this.dbg.log('API', 'setPanMode', { enabled });
    const gesture = this.canvas.selectionHandler.getGesture();
    if (enabled && (gesture === 'rect' || gesture === 'lasso')) {
      return;
    }
    this.canvas.panActive.value = enabled;
    if (enabled) {
      this.canvas.creationHandler.setActiveType(null);
    }
    this.canvas.events.emit('SVG_CAD_PAN_MODE_CHANGED', { enabled });
  }

  public setPanHeld(held: boolean): void {
    this.canvas.camera.panHeld = held;
    const gesture = this.canvas.selectionHandler.getGesture();
    const isCreating = this.canvas.creationHandler.activeType !== null;
    if (gesture === 'rect' || gesture === 'lasso' || isCreating) {
      this.canvas.panActive.value = held;
    }
  }

  public setActiveCreationTool(type: ElementType | null): void {
    this.dbg.log('API', 'setActiveCreationTool', { type });
    if (this.canvas.cutParamsController.isActive()) {
      this.dbg.log('API', 'setActiveCreationTool blocked (cut-params mode)');
      return;
    }
    if (type !== null) {
      this.canvas.panActive.value = false;
    } else {
      const gesture = this.canvas.selectionHandler.getGesture();
      if (gesture !== 'rect' && gesture !== 'lasso') {
        this.canvas.panActive.value = true;
      }
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
