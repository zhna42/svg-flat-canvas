import type { IModeRenderer } from './types';
import type { CutParamsGradingResult } from './types';
import type { LaserStyleOverride } from '@/modules/laser/laser-types';
import { CutParamsGrading } from './CutParamsGrading';
import { DEFAULT_UNASSIGNED_OPACITY } from './constants';

export class CutParamsRenderer implements IModeRenderer {
  private grading: CutParamsGrading;
  private gradingCache = new Map<string, CutParamsGradingResult>();
  private _active = false;

  constructor(grading: CutParamsGrading) {
    this.grading = grading;
  }

  public setActive(v: boolean): void {
    this._active = v;
    if (v) this.recompute();
  }

  public isActive(): boolean {
    return this._active;
  }

  public recompute(): void {
    this.gradingCache.clear();
    const results = this.grading.compute();
    for (const r of results) {
      this.gradingCache.set(r.elementId, r);
    }
  }

  public refresh(): void {
    this.recompute();
  }

  public getGradingResults(): CutParamsGradingResult[] {
    return Array.from(this.gradingCache.values());
  }

  public getStyleOverride(id: string): LaserStyleOverride | null {
    if (!this._active) return null;
    const result = this.gradingCache.get(id);
    if (!result) {
      return {
        fill: '#000000',
        stroke: 'none',
        opacity: DEFAULT_UNASSIGNED_OPACITY,
      };
    }

    const o: LaserStyleOverride = {
      fill: result.fill,
      opacity: result.opacity,
    };

    if (result.stroke !== 'none') {
      o.stroke = result.stroke;
      o.strokeWidth = result.strokeWidth;
    }

    return o;
  }
}
