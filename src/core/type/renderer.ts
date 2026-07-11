export interface Renderable {
  get dirty(): boolean;
  markClean(): void;
  flushToDOM(): void;
}
