export type TimeMachineRecordType = 'ROOT' | import('@/commands/types').CommandType;

export interface TimeMachineRecord {
  type: TimeMachineRecordType;
  elements: Record<string, Record<string, unknown>>;
  groups?: Record<string, Record<string, unknown>>;
  timestamp: number;
}

export class TimeMachine {
  private root: TimeMachineRecord | null = null;
  private records: TimeMachineRecord[] = [];
  private pointer = -1;
  private readonly maxRecords: number;
  private getElements: () => { id: string; toDTO(): Record<string, unknown> }[];
  private getGroups: () => { id: string; toDTO(): Record<string, unknown> }[];
  private applyElementDTO: (dto: Record<string, unknown>) => void;
  private applyGroupsCb: (groups: Record<string, Record<string, unknown>>) => void;
  private onUpdate: (() => void) | null = null;

  public constructor(
    getElements: () => { id: string; toDTO(): Record<string, unknown> }[],
    getGroups: () => { id: string; toDTO(): Record<string, unknown> }[],
    applyElementDTO: (dto: Record<string, unknown>) => void,
    applyGroupsCb: (groups: Record<string, Record<string, unknown>>) => void,
    maxRecords = 100,
  ) {
    this.getElements = getElements;
    this.getGroups = getGroups;
    this.applyElementDTO = applyElementDTO;
    this.applyGroupsCb = applyGroupsCb;
    this.maxRecords = maxRecords;
  }

  public setOnUpdate(fn: (() => void) | null): void { this.onUpdate = fn; }
  public get canUndo(): boolean { return this.pointer >= (this.root ? -1 : 0); }
  public get canRedo(): boolean { return this.pointer < this.records.length - 1; }
  public get index(): number { return this.pointer; }
  public get totalRecords(): number { return this.records.length; }

  public captureRoot(): void {
    const elements: Record<string, Record<string, unknown>> = {};
    for (const el of this.getElements()) elements[el.id] = el.toDTO();
    const groups: Record<string, Record<string, unknown>> = {};
    for (const g of this.getGroups()) groups[g.id] = g.toDTO();
    this.root = { type: 'ROOT', elements, groups, timestamp: Date.now() };
    this.records = [];
    this.pointer = -1;
  }

  public push(type: TimeMachineRecordType): void {
    const elements: Record<string, Record<string, unknown>> = {};
    for (const el of this.getElements()) elements[el.id] = el.toDTO();
    const groups: Record<string, Record<string, unknown>> = {};
    for (const g of this.getGroups()) groups[g.id] = g.toDTO();
    this.pointer++;
    this.records.length = this.pointer;
    this.records.push({ type, elements, groups, timestamp: Date.now() });
    if (this.records.length > this.maxRecords) { this.records.shift(); this.pointer--; }
    this.onUpdate?.();
  }

  public undo(): void {
    if (this.pointer < -1) return;
    if (this.pointer === -1) return;
    this.pointer--;
    this.restore(this.pointer);
    this.onUpdate?.();
  }

  public redo(): void {
    if (!this.canRedo) return;
    this.pointer++;
    this.restore(this.pointer);
    this.onUpdate?.();
  }

  public clear(): void { this.root = null; this.records = []; this.pointer = -1; this.onUpdate?.(); }

  public toJSON(): TimeMachineRecord[] { return this.root ? [this.root, ...this.records] : this.records; }

  public fromJSON(records: TimeMachineRecord[]): void {
    if (records.length > 0 && records[0].type === 'ROOT') {
      this.root = records[0];
      this.records = records.slice(1);
    } else { this.root = null; this.records = records; }
    this.pointer = this.records.length - 1;
  }

  private restore(index: number): void {
    const record = index < 0 ? this.root : this.records[index];
    if (!record) return;
    for (const dto of Object.values(record.elements)) this.applyElementDTO(dto);
    if (record.groups) this.applyGroupsCb(record.groups);
  }
}
