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

    const hasFill = new Set<string>();
    for (const el of elements) {
      if (el.style.fill && el.style.fill !== 'none') {
        hasFill.add(el.id);
      }
    }

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

    let cutMaxCount = 0;
    let vectorMaxCount = 0;
    let rasterMaxCount = 0;
    let maxFactor = 0;
    for (const entry of info.values()) {
      if (entry.cutCount > cutMaxCount) cutMaxCount = entry.cutCount;
      if (entry.vectorEngraveCount > vectorMaxCount)
        vectorMaxCount = entry.vectorEngraveCount;
      if (entry.rasterEngraveCount > rasterMaxCount)
        rasterMaxCount = entry.rasterEngraveCount;
      if (entry.totalCount > 0 && entry.totalFactor > maxFactor)
        maxFactor = entry.totalFactor;
    }

    const cutStep = cutMaxCount > 0 ? 1.0 / cutMaxCount : 1.0;
    const vectorStep = vectorMaxCount > 0 ? 1.0 / vectorMaxCount : 1.0;
    const rasterStep = rasterMaxCount > 0 ? 1.0 / rasterMaxCount : 1.0;

    const results: CutParamsGradingResult[] = [];

    for (const entry of info.values()) {
      const { elementId, totalCount, cutCount, vectorEngraveCount, rasterEngraveCount, totalFactor } = entry;

      if (totalCount === 0) {
        results.push({
          elementId,
          fill: hasFill.has(elementId) ? RASTER_ENGRAVE_COLOR : 'none',
          stroke: 'none',
          strokeWidth: 0,
          opacity: DEFAULT_UNASSIGNED_OPACITY,
        });
        continue;
      }

      const normalized = maxFactor > 0 ? totalFactor / maxFactor : 0;
      const powerDim = cutMaxCount + vectorMaxCount + rasterMaxCount <= 1
        ? 0
        : normalized * 0.3;

      let fill: string;
      let stroke: string;
      let strokeWidth = 0;

      if (vectorEngraveCount > 0) {
        const intensity = Math.min(vectorStep * vectorEngraveCount, 1.0);
        const lightness = clampL(100 - intensity * 80 - powerDim * 10, 15, 90);
        fill = `hsl(240, 100%, ${lightness}%)`;
      } else if (rasterEngraveCount > 0) {
        const intensity = Math.min(rasterStep * rasterEngraveCount, 1.0);
        const lightness = clampL(100 - intensity * 80 - powerDim * 10, 8, 85);
        fill = `hsl(0, 0%, ${lightness}%)`;
      } else {
        fill = CUT_FILL;
      }

      if (cutCount > 0) {
        const cutIntensity = Math.min(cutStep * cutCount, 1.0);
        const avgPower = this.computeAvgCutPower(elementId, groups);
        const hue = CUT_HUE_MIN +
          (1 - (avgPower / 100) * cutIntensity) * (CUT_HUE_MAX - CUT_HUE_MIN);
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
        opacity: 1,
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

function clampL(v: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, v)));
}
