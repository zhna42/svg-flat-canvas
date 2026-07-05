import type { Group } from '@/shapes/group/Group';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export const computeGroupWorldBBox = (
  g: Group,
  findElement: (id: string) => AbstractGraphicElement | undefined,
): { x: number; y: number; width: number; height: number } | null => {
  if (g.elementIds.size === 0) return null;

  if (!g._bboxDirty && g._cachedWorldBBox) {
    return g._cachedWorldBBox;
  }

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

  g._cachedWorldBBox = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
  g._bboxDirty = false;
  return g._cachedWorldBBox;
};

export const computeGroupOBB = (
  g: Group,
  findElement: (id: string) => AbstractGraphicElement | undefined,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
} | null => {
  if (g.elementIds.size === 0) return null;

  const angleRad = (g.obbAngle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  let sumCx = 0;
  let sumCy = 0;
  let pointCount = 0;

  const allCorners: Array<{ x: number; y: number }> = [];

  for (const elId of g.elementIds) {
    const el = findElement(elId);
    if (!el) continue;
    const corners = el.getWorldCorners();
    if (corners.length < 4) continue;

    for (const c of corners) {
      allCorners.push(c);
    }

    const center = el.getLocalCenter();
    const elWorldCenter = el.transform.matrix.transformPoint({
      x: center.x,
      y: center.y,
    });
    sumCx += elWorldCenter.x;
    sumCy += elWorldCenter.y;
    pointCount++;
  }

  if (pointCount === 0) return null;

  const obbCx = sumCx / pointCount;
  const obbCy = sumCy / pointCount;

  let minProjX = Infinity;
  let maxProjX = -Infinity;
  let minProjY = Infinity;
  let maxProjY = -Infinity;

  for (const c of allCorners) {
    const rx = c.x - obbCx;
    const ry = c.y - obbCy;
    const projX = rx * cos + ry * sin;
    const projY = -rx * sin + ry * cos;
    if (projX < minProjX) minProjX = projX;
    if (projX > maxProjX) maxProjX = projX;
    if (projY < minProjY) minProjY = projY;
    if (projY > maxProjY) maxProjY = projY;
  }

  const obbWidth = Math.max(maxProjX - minProjX, 1);
  const obbHeight = Math.max(maxProjY - minProjY, 1);

  const projMidX = (minProjX + maxProjX) / 2;
  const projMidY = (minProjY + maxProjY) / 2;

  const refinedCx = obbCx + projMidX * cos - projMidY * sin;
  const refinedCy = obbCy + projMidX * sin + projMidY * cos;

  const x = refinedCx - obbWidth / 2;
  const y = refinedCy - obbHeight / 2;

  return { x, y, width: obbWidth, height: obbHeight, angle: g.obbAngle };
};

export const invalidateGroupBBox = (g: Group): void => {
  g._bboxDirty = true;
  g._cachedWorldBBox = null;
  g._obbDirty = true;
  g._obbCache = null;
};
