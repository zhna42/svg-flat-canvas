export interface GroupData {
  id: string;
  name: string;
  elementIds: string[];
}

export class Group {
  public readonly id: string;
  public name: string;
  public readonly elementIds: Set<string>;

  public constructor(data: GroupData) {
    this.id = data.id;
    this.name = data.name;
    this.elementIds = new Set(data.elementIds);
  }

  public toData(): GroupData {
    return {
      id: this.id,
      name: this.name,
      elementIds: Array.from(this.elementIds),
    };
  }

  public toDTO(): Record<string, unknown> {
    return this.toData() as unknown as Record<string, unknown>;
  }

  public applyDTO(dto: Record<string, unknown>): void {
    if (typeof dto.name === 'string') this.name = dto.name;
    if (Array.isArray(dto.elementIds)) {
      this.elementIds.clear();
      for (const id of dto.elementIds) {
        if (typeof id === 'string') this.elementIds.add(id);
      }
    }
  }
}
