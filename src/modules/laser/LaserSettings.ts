import type { LaserSettingsData, LaserSettingsInfo } from './laser-types';

/** Множитель фокусного пятна (эмпирический). spot_focus = K * F / beam. */
const FOCUS_K = 0.015;

export class LaserSettings {
  public lensFocalMm = 50.8;
  public lensDiameterMm = 20;
  public beamDiameterMm = 5;
  public materialHeightMm = 50.8;
  public engraveColor = '#000000';
  public cutColor = '#ff0000';
  public nonLaserHidden = false;
  public laserTranslucent = false;

  /** Размер пятна в фокусе, мм. */
  public get focusedSpotMm(): number {
    if (this.beamDiameterMm <= 0) return 0;
    return (FOCUS_K * this.lensFocalMm) / this.beamDiameterMm;
  }

  /** Коэффициент раскрытия конуса (прирост пятна на 1 мм расфокуса). */
  public get defocusCoeff(): number {
    if (this.lensFocalMm <= 0) return 0;
    return this.lensDiameterMm / this.lensFocalMm;
  }

  /** Итоговый размер пятна с учётом расфокуса, мм. */
  public get spotSizeMm(): number {
    const defocus = Math.abs(this.materialHeightMm - this.lensFocalMm);
    return this.focusedSpotMm + defocus * this.defocusCoeff;
  }

  /** Рекомендованный DPI: шаг растра = размер пятна. */
  public get recommendedDpi(): number {
    const spot = this.spotSizeMm;
    if (spot <= 0) return 0;
    return Math.round(25.4 / spot);
  }

  public toData(): LaserSettingsData {
    return {
      lensFocalMm: this.lensFocalMm,
      lensDiameterMm: this.lensDiameterMm,
      beamDiameterMm: this.beamDiameterMm,
      materialHeightMm: this.materialHeightMm,
      engraveColor: this.engraveColor,
      cutColor: this.cutColor,
      nonLaserHidden: this.nonLaserHidden,
      laserTranslucent: this.laserTranslucent,
    };
  }

  public toInfo(): LaserSettingsInfo {
    return {
      ...this.toData(),
      spotSizeMm: this.spotSizeMm,
      recommendedDpi: this.recommendedDpi,
    };
  }
}
