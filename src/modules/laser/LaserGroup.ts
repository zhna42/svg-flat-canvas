import type {
  LaserGroupData,
  LaserGroupFields,
  LaserOpType,
} from './laser-types';

const DEFAULTS: Omit<LaserGroupData, 'id' | 'name' | 'elementIds'> = {
  type: 'cut',
  cutSpeed: 10,
  cutPower: 100,
  rasterSpeed: 100,
  rasterPower: 50,
  rasterDpi: 254,
  rasterLineInterval: 0.1,
  vectorSpeed: 100,
  vectorPower: 50,
  vectorFrequency: 20,
  vectorPasses: 1,
  selectable: true,
  movable: true,
  visible: true,
};

function migrateType(t: string): LaserOpType {
  if (t === 'raster_engrave' || t === 'vector_engrave') return t;
  if (t === 'cut_engrave' || t === 'engrave') return 'raster_engrave';
  return 'cut';
}

function migrateFields(
  data: Partial<Record<string, unknown>>,
): Partial<Record<string, unknown>> {
  const d = { ...data };
  if (d.engraveSpeed !== undefined && d.rasterSpeed === undefined)
    d.rasterSpeed = d.engraveSpeed;
  if (d.engravePower !== undefined && d.rasterPower === undefined)
    d.rasterPower = d.engravePower;
  if (d.engraveDpi !== undefined && d.rasterDpi === undefined)
    d.rasterDpi = d.engraveDpi;
  return d;
}

export class LaserGroup {
  public readonly id: string;
  public name: string;
  public type: LaserOpType;
  public readonly elementIds: Set<string>;
  public cutSpeed: number;
  public cutPower: number;
  public rasterSpeed: number;
  public rasterPower: number;
  public rasterDpi: number;
  public rasterLineInterval: number;
  public vectorSpeed: number;
  public vectorPower: number;
  public vectorFrequency: number;
  public vectorPasses: number;
  public selectable: boolean;
  public movable: boolean;
  public visible: boolean;
  public cutLineWidthMm?: number;

  private _savedFlag = false;
  private _unsavedKeys = new Set<string>();

  public constructor(data: Partial<LaserGroupData> & { id: string }) {
    const migrated = migrateFields(data as Record<string, unknown>);
    this.id = migrated.id as string;
    this.name = (migrated.name as string) ?? this.id;
    this.type = migrateType((migrated.type as string) ?? DEFAULTS.type);
    this.elementIds = new Set((migrated.elementIds as string[]) ?? []);
    this.cutSpeed = (migrated.cutSpeed as number) ?? DEFAULTS.cutSpeed;
    this.cutPower = (migrated.cutPower as number) ?? DEFAULTS.cutPower;
    this.rasterSpeed = (migrated.rasterSpeed as number) ?? DEFAULTS.rasterSpeed;
    this.rasterPower = (migrated.rasterPower as number) ?? DEFAULTS.rasterPower;
    this.rasterDpi = (migrated.rasterDpi as number) ?? DEFAULTS.rasterDpi;
    this.rasterLineInterval =
      (migrated.rasterLineInterval as number) ?? DEFAULTS.rasterLineInterval;
    this.vectorSpeed = (migrated.vectorSpeed as number) ?? DEFAULTS.vectorSpeed;
    this.vectorPower = (migrated.vectorPower as number) ?? DEFAULTS.vectorPower;
    this.vectorFrequency =
      (migrated.vectorFrequency as number) ?? DEFAULTS.vectorFrequency;
    this.vectorPasses =
      (migrated.vectorPasses as number) ?? DEFAULTS.vectorPasses;
    this.selectable = (migrated.selectable as boolean) ?? DEFAULTS.selectable;
    this.movable = (migrated.movable as boolean) ?? DEFAULTS.movable;
    this.visible = (migrated.visible as boolean) ?? DEFAULTS.visible;
    this.cutLineWidthMm = migrated.cutLineWidthMm as number | undefined;
  }

  public get isSaved(): boolean {
    return this._savedFlag && this._unsavedKeys.size === 0;
  }

  public markUnsaved(key: string): void {
    this._unsavedKeys.add(key);
  }

  public applyFields(fields: LaserGroupFields): void {
    if (fields.name !== undefined) this.name = fields.name;
    if (fields.type !== undefined) this.type = fields.type;
    if (fields.cutSpeed !== undefined)
      this.cutSpeed = clampPos(fields.cutSpeed);
    if (fields.cutPower !== undefined)
      this.cutPower = clamp(fields.cutPower, 0, 100);
    if (fields.rasterSpeed !== undefined)
      this.rasterSpeed = clampPos(fields.rasterSpeed);
    if (fields.rasterPower !== undefined)
      this.rasterPower = clamp(fields.rasterPower, 0, 100);
    if (fields.rasterDpi !== undefined)
      this.rasterDpi = clamp(Math.round(fields.rasterDpi), 1, 5000);
    if (fields.rasterLineInterval !== undefined)
      this.rasterLineInterval = clampPos(fields.rasterLineInterval);
    if (fields.vectorSpeed !== undefined)
      this.vectorSpeed = clampPos(fields.vectorSpeed);
    if (fields.vectorPower !== undefined)
      this.vectorPower = clamp(fields.vectorPower, 0, 100);
    if (fields.vectorFrequency !== undefined)
      this.vectorFrequency = clampPos(fields.vectorFrequency);
    if (fields.vectorPasses !== undefined)
      this.vectorPasses = clamp(Math.round(fields.vectorPasses), 1, 100);
    if (fields.selectable !== undefined) this.selectable = fields.selectable;
    if (fields.movable !== undefined) this.movable = fields.movable;
    if (fields.visible !== undefined) this.visible = fields.visible;
    if (fields.cutLineWidthMm !== undefined)
      this.cutLineWidthMm = fields.cutLineWidthMm;
    for (const k of Object.keys(fields)) this.markUnsaved(k);
  }

  public toData(): LaserGroupData {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      elementIds: Array.from(this.elementIds),
      cutSpeed: this.cutSpeed,
      cutPower: this.cutPower,
      rasterSpeed: this.rasterSpeed,
      rasterPower: this.rasterPower,
      rasterDpi: this.rasterDpi,
      rasterLineInterval: this.rasterLineInterval,
      vectorSpeed: this.vectorSpeed,
      vectorPower: this.vectorPower,
      vectorFrequency: this.vectorFrequency,
      vectorPasses: this.vectorPasses,
      selectable: this.selectable,
      movable: this.movable,
      visible: this.visible,
      cutLineWidthMm: this.cutLineWidthMm,
    };
  }

  public toDTO(): Record<string, unknown> {
    return this.toData() as unknown as Record<string, unknown>;
  }

  public applyDTO(dto: Record<string, unknown>): void {
    if (dto.elementIds !== undefined) {
      this.elementIds.clear();
      for (const id of dto.elementIds as string[]) this.elementIds.add(id);
    }
    const migrated = migrateFields(dto);
    if (migrated.type !== undefined)
      migrated.type = migrateType(migrated.type as string);
    this.applyFields(migrated as LaserGroupFields);
  }

  public getUnsavedDTO(): Record<string, unknown> | null {
    if (!this._savedFlag) {
      this._savedFlag = true;
      this._unsavedKeys.clear();
      return this.toDTO();
    }
    if (this._unsavedKeys.size === 0) return null;
    const dto: Record<string, unknown> = { id: this.id };
    const full = this.toData() as unknown as Record<string, unknown>;
    for (const key of this._unsavedKeys) dto[key] = full[key];
    this._unsavedKeys.clear();
    return dto;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function clampPos(v: number): number {
  return v > 0 ? v : 0.0001;
}
