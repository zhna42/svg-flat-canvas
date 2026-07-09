import type { LaserGroupManager } from './LaserGroupManager';
import type { LaserSettings } from './LaserSettings';
import type { LaserStyleOverride, LaserColorGrading } from './laser-types';
import { lerpColor } from './color-scale';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

/**
 * Вычисляет градацию гравировки и отдаёт переопределение стиля
 * элемента для CanvasView (цвет/видимость/прозрачность).
 */
export class LaserColorResolver {
  private manager: LaserGroupManager;
  private settings: LaserSettings;
  private getElement: (id: string) => AbstractGraphicElement | undefined;
  private grading: LaserColorGrading = {};

  constructor(
    manager: LaserGroupManager,
    settings: LaserSettings,
    getElement: (id: string) => AbstractGraphicElement | undefined,
  ) {
    this.manager = manager;
    this.settings = settings;
    this.getElement = getElement;
    this.resolve = this.resolve.bind(this);
  }

  /**
   * Пересчитать градацию: white → engraveColor, N+1 шагов, белый пропущен.
   * Самой интенсивной группе (макс мощность / мин скорость) — самый тёмный.
   */
  public recompute(): void {
    const grading: LaserColorGrading = {};
    const engraveGroups = this.manager
      .getGroups()
      .filter((g) => g.type === 'engrave' || g.type === 'cut_engrave');

    const n = engraveGroups.length;
    if (n > 0) {
      const ranked = [...engraveGroups].sort(
        (a, b) => intensity(a) - intensity(b),
      );
      ranked.forEach((g, i) => {
        const t = (i + 1) / n; // i=0 → 1/n (светлее), i=n-1 → 1 (engraveColor)
        grading[g.id] = lerpColor('#ffffff', this.settings.engraveColor, t);
      });
    }
    this.grading = grading;
  }

  public getGrading(): LaserColorGrading {
    return { ...this.grading };
  }

  /** Переопределение стиля для элемента (null — без изменений). */
  public resolve(elementId: string): LaserStyleOverride | null {
    const g = this.manager.getGroupByElement(elementId);
    const o: LaserStyleOverride = {};

    if (!g) {
      if (this.settings.nonLaserHidden) o.visibility = 'hidden';
      return Object.keys(o).length ? o : null;
    }

    if (!g.visible) o.visibility = 'hidden';
    if (this.settings.laserTranslucent) o.opacity = 0.4;

    const hasFlexTree = this.getElement(elementId)?.flexTree !== undefined;

    if (g.type === 'cut') {
      // Резка — контур без фона; при гибком дереве убираем и бордер,
      // чтобы остались только линии пропила (flex cut path).
      o.fill = 'none';
      o.stroke = hasFlexTree ? 'none' : this.settings.cutColor;
      return o;
    }

    if (g.type === 'cut_engrave') {
      o.stroke = this.settings.cutColor;
    }
    if (g.type === 'engrave' || g.type === 'cut_engrave') {
      const color = this.grading[g.id] ?? this.settings.engraveColor;
      o.fill = color;
      if (g.type === 'engrave') {
        // Гравировка — бордер тоже в цвет градации.
        o.stroke = color;
      }
    }
    return Object.keys(o).length ? o : null;
  }
}

function intensity(g: { engravePower: number; engraveSpeed: number }): number {
  return g.engravePower / Math.max(g.engraveSpeed, 0.0001);
}
