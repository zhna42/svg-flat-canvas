import type { GroupData, Point } from '@/types';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { computeGroupWorldBBox } from '@/math/group-bbox-utils';

export class Group {
  public readonly id: string;
  public name: string;
  public readonly elementIds: Set<string>;
  public matrix = new DOMMatrix();

  public _cachedWorldBBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  public _bboxDirty = true;

  protected _savedFlag = false;
  protected _unsavedKeys = new Set<string>();

  public constructor(data: GroupData) {
    this.id = data.id;
    this.name = data.name;
    this.elementIds = new Set(data.elementIds);
  }

  public get isSaved(): boolean {
    return this._savedFlag && this._unsavedKeys.size === 0;
  }

  public markUnsaved(key: string): void {
    this._unsavedKeys.add(key);
  }

  public getUnsavedDTO(): Record<string, unknown> | null {
    if (!this._savedFlag) {
      this._savedFlag = true;
      this._unsavedKeys.clear();
      return this.toDTO();
    }

    const keys = Array.from(this._unsavedKeys);
    this._unsavedKeys.clear();
    if (keys.length === 0) return null;

    const dto: Record<string, unknown> = {};
    for (const key of keys) {
      switch (key) {
        case 'name':
          dto.name = this.name;
          break;
        case 'elementIds':
          dto.elementIds = Array.from(this.elementIds);
          break;
        case 'matrix': {
          const m = this.matrix;
          dto.matrix = [m.a, m.b, m.c, m.d, m.e, m.f];
          break;
        }
      }
    }
    return dto;
  }

  public toData(): GroupData {
    return {
      id: this.id,
      name: this.name,
      elementIds: Array.from(this.elementIds),
    };
  }

  public toDTO(): Record<string, unknown> {
    const d = this.toData() as unknown as Record<string, unknown>;
    const m = this.matrix;
    d.matrix = [m.a, m.b, m.c, m.d, m.e, m.f];
    return d;
  }

  public applyDTO(dto: Record<string, unknown>): void {
    if (typeof dto.name === 'string') {
      this.name = dto.name;
      this.markUnsaved('name');
    }
    if (Array.isArray(dto.elementIds)) {
      this.elementIds.clear();
      for (const id of dto.elementIds) {
        if (typeof id === 'string') this.elementIds.add(id);
      }
      this.markUnsaved('elementIds');
      this._bboxDirty = true;
    }
    if (Array.isArray(dto.matrix) && dto.matrix.length === 6) {
      const [a, b, c, d, e, f] = dto.matrix as number[];
      this.matrix = new DOMMatrix([a, b, c, d, e, f]);
      this.markUnsaved('matrix');
    }
  }

  public getWorldBBox(
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): Required<ReturnType<typeof computeGroupWorldBBox>> | null {
    return computeGroupWorldBBox(this, findElement);
  }

  public getHitAreaBox(
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const bbox = this.getWorldBBox(findElement);
    if (!bbox) return null;
    return {
      minX: bbox.x,
      minY: bbox.y,
      maxX: bbox.x + bbox.width,
      maxY: bbox.y + bbox.height,
    };
  }

  public getHitArea(
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): Point[] {
    const result: Point[] = [];
    for (const elId of this.elementIds) {
      const el = findElement(elId);
      if (!el) continue;
      result.push(...el.getWorldHitPoints());
    }
    return result;
  }

  public getWorldCorners(
    findElement: (id: string) => AbstractGraphicElement | undefined,
  ): Point[] {
    const bbox = this.getWorldBBox(findElement);
    if (!bbox) return [];
    return [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height },
    ];
  }
}
