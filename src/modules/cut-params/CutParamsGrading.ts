import type { LaserGroupManager } from '@/manager/LaserGroupManager';
import type { LaserSettings } from '@/modules/laser/LaserSettings';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { LaserGroup } from '@/modules/laser/LaserGroup';
import type { CutParamsElementInfo, CutParamsGradingResult } from './types';
import {
  DEFAULT_UNASSIGNED_OPACITY,
  RASTER_ENGRAVE_COLOR,
  CUT_FILL,
  CUT_HUE_MIN,
  CUT_HUE_MAX,
  DEFAULT_LINE_WIDTH_PX,
} from './constants';
import { MM_TO_PX } from '@/constants';

function factor(group: LaserGroup): number {
  let speed: number;
  let power: number;
  if (group.type === 'cut') {
    speed = group.cutSpeed;
    power = group.cutPower;
  } else if (group.type === 'vector_engrave') {
    speed = group.vectorSpeed;
    power = group.vectorPower;
  } else {
    speed = group.rasterSpeed;
    power = group.rasterPower;
  }
  if (power <= 0) return 0;
  return speed / power;
}

function cutPower(group: LaserGroup): number {
  return group.cutPower;
}

export class CutParamsGrading {
  private groupManager: LaserGroupManager;
  private settings: LaserSettings;
  private getElements: () => AbstractGraphicElement[];

  constructor(
    groupManager: LaserGroupManager,
    settings: LaserSettings,
    getElements: () => AbstractGraphicElement[],
  ) {
    this.groupManager = groupManager;
    this.settings = settings;
    this.getElements = getElements;
  }

  public compute(): CutParamsGradingResult[] {
    const groups = this.groupManager.getGroups();
    const elements = this.getElements().filter((e) => !e.isPreview);
    const elementIds = new Set(elements.map((e) => e.id));

    const info = new Map<string, CutParamsElementInfo>();

    for (const eid of elementIds) {
      info.set(eid, {
        elementId: eid,
        totalCount: 0,
        cutCount: 0,
        vectorEngraveCount: 0,
        rasterEngraveCount: 0,
        totalFactor: 0,
      });
    }

    for (const group of groups) {
      const gFactor = factor(group);
      for (const eid of group.elementIds) {
        const entry = info.get(eid);
        if (!entry) continue;
        entry.totalCount++;
        entry.totalFactor += gFactor;
        if (group.type === 'cut') entry.cutCount++;
        else if (group.type === 'vector_engrave') entry.vectorEngraveCount++;
        else entry.rasterEngraveCount++;
      }
    }

    let maxCount = 0;
    let maxFactor = 0;
    for (const entry of info.values()) {
      if (entry.totalCount > maxCount) maxCount = entry.totalCount;
      if (entry.totalCount > 0 && entry.totalFactor > maxFactor)
        maxFactor = entry.totalFactor;
    }

    const step = maxCount > 0 ? 1.0 / maxCount : 1.0;

    const results: CutParamsGradingResult[] = [];

    for (const entry of info.values()) {
      const { elementId, totalCount, cutCount, vectorEngraveCount, rasterEngraveCount, totalFactor } = entry;

      if (totalCount === 0) {
        results.push({
          elementId,
          fill: RASTER_ENGRAVE_COLOR,
          stroke: 'none',
          strokeWidth: 0,
          opacity: DEFAULT_UNASSIGNED_OPACITY,
        });
        continue;
      }

      const normalized = maxFactor > 0 ? totalFactor / maxFactor : 0;
      const baseOpacity = Math.min(step * totalCount, 1.0);
      const opacity = clampOpacity(
        baseOpacity * (1 - normalized * 0.5),
      );

      let fill: string;
      let stroke: string;
      let strokeWidth = 0;

      if (vectorEngraveCount > 0) {
        const lightness = Math.round(20 + normalized * 30);
        fill = `hsl(240, 100%, ${lightness}%)`;
      } else if (rasterEngraveCount > 0) {
        const lightness = Math.round(normalized * 30);
        fill = `hsl(0, 0%, ${lightness}%)`;
      } else {
        fill = CUT_FILL;
      }

      if (cutCount > 0) {
        const avgPower = this.computeAvgCutPower(elementId, groups);
        const hue = CUT_HUE_MIN + (1 - avgPower / 100) * (CUT_HUE_MAX - CUT_HUE_MIN);
        stroke = `hsl(${Math.round(hue)}, 100%, 50%)`;
        strokeWidth = this.computeStrokeWidth(elementId, groups);
      } else {
        stroke = 'none';
      }

      results.push({
        elementId,
        fill,
        stroke,
        strokeWidth,
        opacity,
      });
    }

    return results;
  }

  private computeAvgCutPower(elementId: string, groups: LaserGroup[]): number {
    let sum = 0;
    let count = 0;
    for (const g of groups) {
      if (g.type === 'cut' && g.elementIds.has(elementId)) {
        sum += cutPower(g);
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  private computeStrokeWidth(elementId: string, groups: LaserGroup[]): number {
    for (const g of groups) {
      if (g.type === 'cut' && g.elementIds.has(elementId) && g.cutLineWidthMm !== undefined) {
        return g.cutLineWidthMm * MM_TO_PX;
      }
    }
    return this.settings.spotSizeMm * MM_TO_PX || DEFAULT_LINE_WIDTH_PX;
  }
}

function clampOpacity(v: number): number {
  return Math.min(1, Math.max(0.05, v));
}
