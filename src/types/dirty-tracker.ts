export interface DirtyTracker {
  readonly dirty: boolean;
  markClean(): void;
}
