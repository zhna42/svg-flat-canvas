export type EntityKind = 'element' | 'group' | 'camera' | 'selection';

export interface EntitySnapshot {
  id: string;
  kind: EntityKind;
  dto: Record<string, unknown>;
}

export interface TimeMachineRecordOld {
  type: string;
  before: EntitySnapshot[];
  after: EntitySnapshot[];
  timestamp: number;
}
