import type { Group } from '@/group/Group';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export const computeGroupWorldBBox = (
  g: Group,
  findElement: (id: string) => AbstractGraphicElement | undefined,
): { x: number; y: number; width: number; height: number } | null => {
  if (g.elementIds.size === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let hasAny = false;

  for (const elId of g.elementIds) {
    const el = findElement(elId);
    if (!el) continue;
    const bbox = el.getWorldBBox();
    if (bbox.width === 0 && bbox.height === 0) continue;
    hasAny = true;
    if (bbox.x < minX) minX = bbox.x;
    if (bbox.y < minY) minY = bbox.y;
    if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
    if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
  }

  if (!hasAny) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};
