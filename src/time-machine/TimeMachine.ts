export type TimeMachineRecordType = 'ROOT' | import('@/commands/types').CommandType;

export interface TimeMachineRecord {
  type: TimeMachineRecordType;
  elements: Record<string, Record<string, unknown>>;
  timestamp: number;
}

export class TimeMachine {
  private root: TimeMachineRecord | null = null;
  private records: TimeMachineRecord[] = [];
  private pointer = -1;
  private readonly maxRecords: number;
  private getElements: () => { id: string; toDTO(): Record<string, unknown> }[];
  private applyElementDTO: (dto: Record<string, unknown>) => void;
  private onUpdate: (() => void) | null = null;

  public constructor(
    getElements: () => { id: string; toDTO(): Record<string, unknown> }[],
    applyElementDTO: (dto: Record<string, unknown>) => void,
    maxRecords = 100,
  ) {
    this.getElements = getElements;
    this.applyElementDTO = applyElementDTO;
    this.maxRecords = maxRecords;
  }

  public setOnUpdate(fn: (() => void) | null): void {
    this.onUpdate = fn;
  }

  public get canUndo(): boolean {
    return this.pointer >= (this.root ? -1 : 0);
  }

  public get canRedo(): boolean {
    return this.pointer < this.records.length - 1;
  }

  public get index(): number {
    return this.pointer;
  }

  public get totalRecords(): number {
    return this.records.length;
  }

  public captureRoot(): void {
    const elements: Record<string, Record<string, unknown>> = {};
    for (const el of this.getElements()) {
      elements[el.id] = el.toDTO();
    }
    this.root = { type: 'ROOT', elements, timestamp: Date.now() };
    this.records = [];
    this.pointer = -1;
    console.log(`[TimeMachine] root captured, elements:${Object.keys(elements).length}`);
  }

  public push(type: TimeMachineRecordType): void {
    const elements: Record<string, Record<string, unknown>> = {};
    for (const el of this.getElements()) {
      elements[el.id] = el.toDTO();
    }

    this.pointer++;
    this.records.length = this.pointer;
    this.records.push({ type, elements, timestamp: Date.now() });

    if (this.records.length > this.maxRecords) {
      this.records.shift();
      this.pointer--;
    }

    console.log(`[TimeMachine] push #${this.pointer} ${type} elements:${Object.keys(elements).length}`);

    this.onUpdate?.();
  }

  public undo(): void {
    if (this.pointer < -1) return;

    if (this.pointer === -1) {
      console.log('[TimeMachine] undo: already at root');
      return;
    }

    const target = this.pointer - 1;
    console.log(`[TimeMachine] undo: pointer ${this.pointer} -> ${target}`);

    this.restore(target);
    this.pointer = target;

    this.onUpdate?.();
  }

  public redo(): void {
    if (!this.canRedo) return;

    const target = this.pointer + 1;
    console.log(`[TimeMachine] redo: pointer ${this.pointer} -> ${target}`);

    this.restore(target);
    this.pointer = target;

    this.onUpdate?.();
  }

  public clear(): void {
    this.root = null;
    this.records = [];
    this.pointer = -1;
    this.onUpdate?.();
  }

  public toJSON(): TimeMachineRecord[] {
    return this.root ? [this.root, ...this.records] : this.records;
  }

  public fromJSON(records: TimeMachineRecord[]): void {
    if (records.length > 0 && records[0].type === 'ROOT') {
      this.root = records[0];
      this.records = records.slice(1);
    } else {
      this.root = null;
      this.records = records;
    }
    this.pointer = this.records.length - 1;
  }

  private restore(index: number): void {
    if (index < 0) {
      if (this.root) {
        console.log(`[TimeMachine] restore root, elements:${Object.keys(this.root.elements).length}`);
        for (const dto of Object.values(this.root.elements)) {
          this.applyElementDTO(dto);
        }
      }
      return;
    }

    const record = this.records[index];
    console.log(`[TimeMachine] restore #${index} ${record.type} elements:${Object.keys(record.elements).length}`);

    for (const dto of Object.values(record.elements)) {
      this.applyElementDTO(dto);
    }
  }
}
