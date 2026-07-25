import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type {
  LaserGroupCreateDTO,
  LaserGroupData,
  LaserGroupFields,
  LaserOpType,
  LaserSettingsInfo,
} from '@/modules/laser';

export class LaserController {
  constructor(private canvas: SvgCanvas) {}

  createLaserGroup(dto?: LaserGroupCreateDTO): string {
    const withDpi: LaserGroupCreateDTO = {
      rasterDpi: this.canvas.laserSettings.recommendedDpi,
      ...dto,
    };
    return this.canvas.laserGroupManager.createGroup(withDpi);
  }

  deleteLaserGroup(id: string): void {
    this.canvas.laserGroupManager.deleteGroup(id);
  }

  laserGroupAddElements(id: string, elementIds: string[]): void {
    for (const eid of elementIds)
      this.canvas.laserGroupManager.addToGroup(id, eid);
  }

  laserGroupRemoveElements(id: string, elementIds: string[]): void {
    for (const eid of elementIds)
      this.canvas.laserGroupManager.removeFromGroup(id, eid);
  }

  clearLaserGroup(id: string): void {
    this.canvas.laserGroupManager.clearGroup(id);
  }

  updateLaserGroup(id: string, fields: LaserGroupFields): void {
    this.canvas.laserGroupManager.updateGroup(id, fields);
  }

  setLaserGroupType(id: string, type: LaserOpType): void {
    this.canvas.laserGroupManager.updateGroup(id, { type });
  }

  setLaserGroupSelectable(id: string, selectable: boolean): void {
    this.canvas.laserGroupManager.updateGroup(id, { selectable });
  }

  setLaserGroupMovable(id: string, movable: boolean): void {
    this.canvas.laserGroupManager.updateGroup(id, { movable });
  }

  setLaserGroupVisible(id: string, visible: boolean): void {
    this.canvas.laserGroupManager.updateGroup(id, { visible });
  }

  getLaserGroups(): LaserGroupData[] {
    return this.canvas.laserGroupManager.getGroups().map((g) => g.toData());
  }

  getLaserGroup(id: string): LaserGroupData | null {
    return this.canvas.laserGroupManager.getGroup(id)?.toData() ?? null;
  }

  getLaserGroupByElement(elementId: string): LaserGroupData | null {
    return (
      this.canvas.laserGroupManager.getGroupByElement(elementId)?.toData() ??
      null
    );
  }

  getElementIdsInLaserGroup(id: string): string[] {
    return this.canvas.laserGroupManager.getElementIdsInGroup(id);
  }

  loadLaserGroups(data: LaserGroupData[]): void {
    this.canvas.laserGroupManager.loadGroups(data);
  }

  addLaserGroups(data: LaserGroupData[]): void {
    this.canvas.laserGroupManager.addGroups(data);
  }

  replaceLaserGroups(data: LaserGroupData[]): void {
    this.canvas.laserGroupManager.replaceGroups(data);
  }

  updateLaserGroups(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    this.canvas.laserGroupManager.updateGroups(patches);
  }

  getUnsavedLaserGroupDTOs(): Array<Record<string, unknown>> {
    return this.canvas.laserGroupManager.getUnsavedDTOs();
  }

  setLaserLensFocal(mm: number): void {
    this.canvas.laserSettings.lensFocalMm = mm;
    this._emitLaserSettings();
  }

  setLaserLensDiameter(mm: number): void {
    this.canvas.laserSettings.lensDiameterMm = mm;
    this._emitLaserSettings();
  }

  setLaserBeamDiameter(mm: number): void {
    this.canvas.laserSettings.beamDiameterMm = mm;
    this._emitLaserSettings();
  }

  setLaserMaterialHeight(mm: number): void {
    this.canvas.laserSettings.materialHeightMm = mm;
    this._emitLaserSettings();
  }

  setLaserEngraveColor(hex: string): void {
    this.canvas.laserSettings.engraveColor = hex;
    this.canvas._refreshLaser();
    this._emitLaserSettings();
  }

  setLaserCutColor(hex: string): void {
    this.canvas.laserSettings.cutColor = hex;
    this.canvas._refreshLaser();
    this._emitLaserSettings();
  }

  getLaserSpotSize(): number {
    return this.canvas.laserSettings.spotSizeMm;
  }

  getLaserRecommendedDpi(): number {
    return this.canvas.laserSettings.recommendedDpi;
  }

  getLaserSettings(): LaserSettingsInfo {
    return this.canvas.laserSettings.toInfo();
  }

  setNonLaserElementsVisible(visible: boolean): void {
    this.canvas.laserSettings.nonLaserHidden = !visible;
    this.canvas.view.refreshLaserStyles();
    this.canvas.events.emit('LASER_VISIBILITY_CHANGED', {
      nonLaserHidden: this.canvas.laserSettings.nonLaserHidden,
      laserTranslucent: this.canvas.laserSettings.laserTranslucent,
    });
  }

  setLaserElementsTranslucent(translucent: boolean): void {
    this.canvas.laserSettings.laserTranslucent = translucent;
    this.canvas.view.refreshLaserStyles();
    this.canvas.events.emit('LASER_VISIBILITY_CHANGED', {
      nonLaserHidden: this.canvas.laserSettings.nonLaserHidden,
      laserTranslucent: translucent,
    });
  }

  getLaserColorGrading(): Record<string, string> {
    return this.canvas.laserColorResolver.getGrading();
  }

  getLaserGroupState(): {
    groups: LaserGroupData[];
    settings: LaserSettingsInfo;
    grading: Record<string, string>;
  } {
    return {
      groups: this.getLaserGroups(),
      settings: this.getLaserSettings(),
      grading: this.getLaserColorGrading(),
    };
  }

  private _emitLaserSettings(): void {
    this.canvas.events.emit(
      'LASER_SETTINGS_CHANGED',
      this.canvas.laserSettings.toInfo(),
    );
  }
}
