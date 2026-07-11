import type { SvgCanvas } from '@/canvas/SvgCanvas';
import {
  FlexTree,
  FLEX_TREE_PRESETS,
  FLEX_VALIDATION,
  type FlexTreeAlgorithm,
} from '@/core/math/flex-tree';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export class FlexTreeController {
  constructor(private canvas: SvgCanvas) {}

  private ensureFlexTree(id: string): FlexTree | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return null;
    if (!el.flexTree) el.flexTree = new FlexTree();
    return el.flexTree;
  }

  setFlexTreeAlgorithm(id: string, algorithm: FlexTreeAlgorithm): void {
    const ft = this.ensureFlexTree(id);
    if (!ft) return;
    ft.algorithm = algorithm;
    this.canvas.events.emit('FLEX_TREE_CHANGED', { id, algorithm });
  }

  setFlexTreeParams(
    id: string,
    params: Partial<{
      step: number;
      link: number;
      dash: number;
      amplitude: number;
    }>,
  ): void {
    const ft = this.ensureFlexTree(id);
    if (!ft) return;
    if (params.step !== undefined) {
      ft.step = clamp(
        params.step,
        FLEX_VALIDATION.step.min,
        FLEX_VALIDATION.step.max,
      );
    }
    if (params.link !== undefined) {
      ft.link = clamp(
        params.link,
        FLEX_VALIDATION.link.min,
        FLEX_VALIDATION.link.max,
      );
    }
    if (params.dash !== undefined) {
      ft.dash = clamp(
        params.dash,
        FLEX_VALIDATION.dash.min,
        FLEX_VALIDATION.dash.max,
      );
    }
    if (params.amplitude !== undefined) {
      const maxA = ft.step / 2 - 0.5;
      ft.amplitude = clamp(params.amplitude, 0, Math.max(0, maxA));
    }
    this.canvas.events.emit('FLEX_TREE_CHANGED', {
      id,
      step: ft.step,
      link: ft.link,
      dash: ft.dash,
      amplitude: ft.amplitude,
    });
  }

  applyFlexTreePreset(
    id: string,
    preset: 'thin' | 'standard' | 'thick',
  ): void {
    const ft = this.ensureFlexTree(id);
    if (!ft) return;
    const p = FLEX_TREE_PRESETS[preset];
    ft.step = p.step;
    ft.link = p.link;
    ft.dash = p.dash;
    ft.amplitude = p.amplitude;
    this.canvas.events.emit('FLEX_TREE_CHANGED', { id, preset });
  }

  getFlexTreeConfig(id: string): {
    algorithm: FlexTreeAlgorithm;
    step: number;
    link: number;
    dash: number;
    amplitude: number;
  } | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el || !el.flexTree) return null;
    const ft = el.flexTree;
    return {
      algorithm: ft.algorithm,
      step: ft.step,
      link: ft.link,
      dash: ft.dash,
      amplitude: ft.amplitude,
    };
  }

  removeFlexTree(id: string): void {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return;
    el.flexTree = undefined;
    this.canvas.events.emit('FLEX_TREE_REMOVED', { id });
  }
}
