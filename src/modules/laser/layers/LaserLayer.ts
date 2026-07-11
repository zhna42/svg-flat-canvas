import type { LaserLayerData } from './types';

export class LaserLayer {
  public readonly id: string;
  public name: string;
  public visible: boolean;
  public readonly groupIds: Set<string>;

  constructor(data: Partial<LaserLayerData> & { id: string }) {
    this.id = data.id;
    this.name = data.name ?? data.id;
    this.visible = data.visible ?? true;
    this.groupIds = new Set(data.groupIds ?? []);
  }

  public toData(): LaserLayerData {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      groupIds: Array.from(this.groupIds),
    };
  }
}
