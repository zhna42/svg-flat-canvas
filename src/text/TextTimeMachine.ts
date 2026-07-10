/**
 * Локальная машина времени для редактирования текста.
 * Хранит снимки HTML-контента; шаг = замена + перерисовка div.
 */
export class TextTimeMachine {
  private records: string[] = [];
  private index = -1;
  private apply: (html: string) => void;

  constructor(initialContent: string, apply: (html: string) => void) {
    this.apply = apply;
    this.records.push(initialContent);
    this.index = 0;
  }

  public get canUndo(): boolean {
    return this.index > 0;
  }
  public get canRedo(): boolean {
    return this.index < this.records.length - 1;
  }

  public capture(content: string): void {
    this.records.splice(
      this.index + 1,
      this.records.length - this.index - 1,
      content,
    );
    this.index = this.records.length - 1;
  }

  public undo(): void {
    if (!this.canUndo) return;
    this.index--;
    this.apply(this.records[this.index]);
  }

  public redo(): void {
    if (!this.canRedo) return;
    this.index++;
    this.apply(this.records[this.index]);
  }
}
