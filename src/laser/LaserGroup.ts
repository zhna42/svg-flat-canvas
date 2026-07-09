import type {
  LaserGroupData,
  LaserGroupFields,
  LaserOpType,
} from './laser-types';

const DEFAULTS: Omit<LaserGroupData, 'id' | 'name' | 'elementIds'> = {
  type: 'cut',
  cutSpeed: 10,
  cutPower: 100,
  engraveSpeed: 100,
  engravePower: 50,
  engraveDpi: 254,
  selectable: true,
  movable: true,
  visible: true,
};

export class LaserGroup {
  public readonly id: string;
  public name: string;
  public type: LaserOpType;
  public readonly elementIds: Set<string>;
  public cutSpeed: number;
  public cutPower: number;
  public engraveSpeed: number;
  public engravePower: number;
  public engraveDpi: number;
  public selectable: boolean;
  public movable: boolean;
  public visible: boolean;

  private _savedFlag = false;
  private _unsavedKeys = new Set<string>();

  public constructor(data: Partial<LaserGroupData> & { id: string }) {
    this.id = data.id;
    this.name = data.name ?? data.id;
    this.type = data.type ?? DEFAULTS.type;
    this.elementIds = new Set(data.elementIds ?? []);
    this.cutSpeed = data.cutSpeed ?? DEFAULTS.cutSpeed;
    this.cutPower = data.cutPower ?? DEFAULTS.cutPower;
    this.engraveSpeed = data.engraveSpeed ?? DEFAULTS.engraveSpeed;
    this.engravePower = data.engravePower ?? DEFAULTS.engravePower;
    this.engraveDpi = data.engraveDpi ?? DEFAULTS.engraveDpi;
    this.selectable = data.selectable ?? DEFAULTS.selectable;
    this.movable = data.movable ?? DEFAULTS.movable;
    this.visible = data.visible ?? DEFAULTS.visible;
  }

  public get isSaved(): boolean {
    return this._savedFlag && this._unsavedKeys.size === 0;
  }

  public markUnsaved(key: string): void {
    this._unsavedKeys.add(key);
  }

  /** Применить набор полей (с валидацией диапазонов). */
  public applyFields(fields: LaserGroupFields): void {
    if (fields.name !== undefined) this.name = fields.name;
    if (fields.type !== undefined) this.type = fields.type;
    if (fields.cutSpeed !== undefined)
      this.cutSpeed = clampPos(fields.cutSpeed);
    if (fields.cutPower !== undefined)
      this.cutPower = clamp(fields.cutPower, 0, 100);
    if (fields.engraveSpeed !== undefined)
      this.engraveSpeed = clampPos(fields.engraveSpeed);
    if (fields.engravePower !== undefined)
      this.engravePower = clamp(fields.engravePower, 0, 100);
    if (fields.engraveDpi !== undefined)
      this.engraveDpi = clamp(Math.round(fields.engraveDpi), 1, 5000);
    if (fields.selectable !== undefined) this.selectable = fields.selectable;
    if (fields.movable !== undefined) this.movable = fields.movable;
    if (fields.visible !== undefined) this.visible = fields.visible;
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
      engraveSpeed: this.engraveSpeed,
      engravePower: this.engravePower,
      engraveDpi: this.engraveDpi,
      selectable: this.selectable,
      movable: this.movable,
      visible: this.visible,
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
    this.applyFields(dto as LaserGroupFields);
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
