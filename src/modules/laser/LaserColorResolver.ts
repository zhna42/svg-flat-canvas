import type { LaserGroupManager } from '@/manager/LaserGroupManager';
import type { LaserSettings } from './LaserSettings';
import type { LaserStyleOverride, LaserColorGrading } from './laser-types';

export class LaserColorResolver {
  private manager: LaserGroupManager;
  private settings: LaserSettings;
  private grading: LaserColorGrading = {};

  constructor(
    manager: LaserGroupManager,
    settings: LaserSettings,
    _getElement: (id: string) => unknown,
  ) {
    this.manager = manager;
    this.settings = settings;
    this.resolve = this.resolve.bind(this);
  }

  public recompute(): void {
    this.grading = {};
  }

  public getGrading(): LaserColorGrading {
    return { ...this.grading };
  }

  public resolve(elementId: string): LaserStyleOverride | null {
    const g = this.manager.getGroupByElement(elementId);
    const o: LaserStyleOverride = {};

    if (!g) {
      if (this.settings.nonLaserHidden) o.visibility = 'hidden';
      return Object.keys(o).length ? o : null;
    }

    if (!g.visible) o.visibility = 'hidden';
    if (this.settings.laserTranslucent) o.opacity = 0.4;

    if (g.type === 'cut') {
      o.fill = 'none';
      o.stroke = '#ff0000';
      return o;
    }

    if (g.type === 'raster_engrave') {
      o.fill = '#0000ff';
      o.stroke = 'none';
      return o;
    }

    if (g.type === 'vector_engrave') {
      o.fill = '#000000';
      o.stroke = 'none';
      return o;
    }

    return Object.keys(o).length ? o : null;
  }
}
