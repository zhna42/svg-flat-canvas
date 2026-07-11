import type { CommandType } from './commands';

export interface BusEvent {
  type: string;
  data: unknown;
}

export type SnapshotCommand = CommandType | 'ROOT';

export interface EntityDiff {
  id: string;
  diff: Record<string, unknown>;
}

export interface TimeSnapshot {
  command: SnapshotCommand;
  selectIds: string[];
  selectType: 'element' | 'group';
  data: EntityDiff[];
}
