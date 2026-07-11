import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { MeasureTool, ProtractorMode, MeasureResult } from '@/core/type';

export class MeasureController {
  constructor(private canvas: SvgCanvas) {}

  activateRuler(): void {
    this.canvas.measure.activate('ruler');
  }

  activateProtractor(mode: ProtractorMode = 'points'): void {
    this.canvas.measure.setProtractorMode(mode);
    this.canvas.measure.activate('protractor');
  }

  setProtractorMode(mode: ProtractorMode): void {
    this.canvas.measure.setProtractorMode(mode);
  }

  deactivateMeasureTool(): void {
    this.canvas.measure.deactivate();
  }

  getMeasureTool(): MeasureTool | null {
    return this.canvas.measure.tool;
  }

  cancelMeasure(): void {
    this.canvas.measure.cancelPending();
  }

  clearMeasurements(): void {
    this.canvas.measure.clearAll();
  }

  removeMeasurement(id: string): void {
    this.canvas.measure.removeMeasurement(id);
  }

  getMeasurements(): MeasureResult[] {
    return this.canvas.measure.getResults();
  }
}
