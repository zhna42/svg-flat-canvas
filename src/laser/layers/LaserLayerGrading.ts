import type { LaserLayerGroupInfo, LaserLayerGradingResult } from './types';

export interface AggregatedElement {
  elementId: string;
  count: number;
  hasCut: boolean;
  hasRasterEngrave: boolean;
  hasVectorEngrave: boolean;
}

export function aggregateElements(
  layerInfos: Array<{ groups: LaserLayerGroupInfo[] }>,
  orphanGroups: LaserLayerGroupInfo[],
): AggregatedElement[] {
  const map = new Map<string, AggregatedElement>();

  function process(infos: LaserLayerGroupInfo[]): void {
    for (const gi of infos) {
      for (const elId of gi.resolvedElementIds) {
        let agg = map.get(elId);
        if (!agg) {
          agg = {
            elementId: elId,
            count: 0,
            hasCut: false,
            hasRasterEngrave: false,
            hasVectorEngrave: false,
          };
          map.set(elId, agg);
        }
        agg.count++;
        if (gi.type === 'cut') agg.hasCut = true;
        if (gi.type === 'raster_engrave') agg.hasRasterEngrave = true;
        if (gi.type === 'vector_engrave') agg.hasVectorEngrave = true;
      }
    }
  }

  for (const li of layerInfos) process(li.groups);
  process(orphanGroups);

  return Array.from(map.values());
}

export function computeLayerGrading(
  aggregated: AggregatedElement[],
): LaserLayerGradingResult[] {
  const maxCount = Math.max(1, ...aggregated.map((a) => a.count));

  return aggregated.map((a) => {
    const opacity = a.count / maxCount;

    let color = 'none';
    if (a.hasRasterEngrave && !a.hasVectorEngrave) color = '#0000ff';
    else if (a.hasVectorEngrave && !a.hasRasterEngrave) color = '#000000';
    else if (a.hasRasterEngrave && a.hasVectorEngrave) color = '#000088';

    return {
      elementId: a.elementId,
      color,
      opacity,
      hasCut: a.hasCut,
      engraveCount: (a.hasRasterEngrave ? 1 : 0) + (a.hasVectorEngrave ? 1 : 0),
      cutCount: a.hasCut ? 1 : 0,
    };
  });
}
