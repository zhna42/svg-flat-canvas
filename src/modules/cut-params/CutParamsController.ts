import type { CutParamsRenderer } from './CutParamsRenderer';
import type { CutParamsGradingResult } from './types';

export class CutParamsController {
  private renderer: CutParamsRenderer;

  public movable = false;
  public resizable = false;

  private _setModeImpl: ((enabled: boolean) => void) | null = null;
  private _isActiveImpl: (() => boolean) | null = null;

  constructor(renderer: CutParamsRenderer) {
    this.renderer = renderer;
  }

  public bindMode(
    setMode: (enabled: boolean) => void,
    isActive: () => boolean,
  ): void {
    this._setModeImpl = setMode;
    this._isActiveImpl = isActive;
  }

  public setMode(enabled: boolean): void {
    this._setModeImpl?.(enabled);
  }

  public isActive(): boolean {
    return this._isActiveImpl?.() ?? false;
  }

  public setMovable(v: boolean): void {
    this.movable = v;
  }

  public setResizable(v: boolean): void {
    this.resizable = v;
  }

  public getGrading(): CutParamsGradingResult[] {
    return this.renderer.getGradingResults();
  }

  public get gradingChangedEvent(): string {
    return 'CUT_PARAMS_GRADING_CHANGED';
  }

  public get modeChangedEvent(): string {
    return 'CUT_PARAMS_MODE_CHANGED';
  }
}
