import type { LaserOpType } from '../laser-types';

export interface LaserLayerData {
  id: string;
  name: string;
  visible: boolean;
  groupIds: string[];
}

export interface LaserLayerCreateDTO {
  name?: string;
  visible?: boolean;
  groupIds?: string[];
}

export interface LaserLayerGroupInfo {
  groupId: string;
  groupName: string;
  type: LaserOpType;
  elementIds: string[];
  resolvedElementIds: string[];
}

export interface LaserLayerGradingResult {
  elementId: string;
  color: string;
  opacity: number;
  hasCut: boolean;
  engraveCount: number;
  cutCount: number;
}

export interface LaserLayerRenderInput {
  layerId: string;
  layerName: string;
  visible: boolean;
  groups: LaserLayerGroupInfo[];
  order: number;
}
