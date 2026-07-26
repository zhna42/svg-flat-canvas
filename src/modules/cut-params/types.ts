import type { LaserStyleOverride } from '@/modules/laser/laser-types';

export interface CutParamsElementInfo {
  elementId: string;
  totalCount: number;
  cutCount: number;
  vectorEngraveCount: number;
  rasterEngraveCount: number;
  totalFactor: number;
}

export interface CutParamsGradingResult {
  elementId: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface IModeRenderer {
  isActive(): boolean;
  getStyleOverride(id: string): LaserStyleOverride | null;
  refresh(): void;
}
