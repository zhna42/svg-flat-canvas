export type EntityKind = 'element' | 'group' | 'camera' | 'selection';

export interface EntitySnapshot {
  id: string;
  kind: EntityKind;
  dto: Record<string, unknown>;
}
