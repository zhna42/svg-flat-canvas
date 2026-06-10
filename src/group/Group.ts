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
}
