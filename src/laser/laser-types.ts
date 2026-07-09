export type LaserOpType = 'cut' | 'engrave' | 'cut_engrave';

export interface LaserGroupData {
  id: string;
  name: string;
  type: LaserOpType;
  elementIds: string[];
  cutSpeed: number;
  cutPower: number;
  engraveSpeed: number;
  engravePower: number;
  engraveDpi: number;
  selectable: boolean;
  movable: boolean;
  visible: boolean;
}

export type LaserGroupFields = Partial<
  Omit<LaserGroupData, 'id' | 'elementIds'>
>;

export interface LaserGroupCreateDTO {
  name?: string;
  type?: LaserOpType;
  cutSpeed?: number;
  cutPower?: number;
  engraveSpeed?: number;
  engravePower?: number;
  engraveDpi?: number;
  selectable?: boolean;
  movable?: boolean;
  visible?: boolean;
}

export const LASER_LENS_FOCALS = [25.4, 38.1, 50.8, 63.5, 76.2, 101.6] as const;

export interface LaserSettingsData {
  lensFocalMm: number;
  lensDiameterMm: number;
  beamDiameterMm: number;
  materialHeightMm: number;
  engraveColor: string;
  cutColor: string;
  nonLaserHidden: boolean;
  laserTranslucent: boolean;
}

export interface LaserSettingsInfo extends LaserSettingsData {
  spotSizeMm: number;
  recommendedDpi: number;
}

/** Переопределение стиля элемента для CanvasView (лазерная визуализация). */
export interface LaserStyleOverride {
  fill?: string;
  stroke?: string;
  visibility?: string;
  opacity?: number;
}

/** Отображение groupId → цвет заливки (градация гравировки). */
export type LaserColorGrading = Record<string, string>;
