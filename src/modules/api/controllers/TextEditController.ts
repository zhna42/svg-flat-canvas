import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { TextController } from '@/modules/text';
import type { TextStylePatch } from '@/modules/text';

export class TextEditController {
  constructor(private canvas: SvgCanvas) {}

  private get tc(): TextController {
    return this.canvas.textController;
  }

  async initTextFonts(apiKey: string): Promise<void> {
    await this.tc.fonts.init(apiKey);
    this.canvas.events.emit('FONTS_READY', {});
  }

  searchFonts(query = '', category?: string) {
    return this.tc.fonts.search(query, category);
  }

  getFontVariants(family: string) {
    return this.tc.fonts.getVariants(family);
  }

  activateTextTool(): void {
    this.canvas.creationHandler.setActiveType('text');
  }

  enterTextEdit(id: string): void {
    this.tc.enterEdit(id);
  }

  exitTextEdit(): void {
    this.tc.exitEdit();
  }

  isTextEditing(): boolean {
    return this.tc.isEditing;
  }

  async setTextStyle(patch: TextStylePatch): Promise<void> {
    await this.tc.applyStyle(patch);
  }

  setTextFontSize(px: number): void {
    void this.tc.applyStyle({ fontSizePx: px });
  }

  setTextFontFamily(family: string): void {
    void this.tc.applyStyle({ fontFamily: family });
  }

  setTextWeight(weight: string): void {
    void this.tc.applyStyle({ fontWeight: weight });
  }

  setTextItalic(italic: boolean): void {
    void this.tc.applyStyle({ italic });
  }

  setTextColor(color: string): void {
    void this.tc.applyStyle({ color });
  }

  setTextUnderline(on: boolean): void {
    void this.tc.applyStyle({ underline: on });
  }

  setTextStrike(on: boolean): void {
    void this.tc.applyStyle({ strike: on });
  }

  setTextAlign(align: 'left' | 'center' | 'right'): void {
    void this.tc.applyStyle({ align });
  }

  getText(id: string): string | null {
    return this.tc.getContent(id);
  }

  setText(id: string, html: string): void {
    this.tc.setContent(id, html);
  }

  deleteTextCharacter(direction: 'forward' | 'backward'): void {
    this.tc.deleteCharacter(direction);
  }

  undoTextEdit(): void {
    this.tc.undo();
  }

  redoTextEdit(): void {
    this.tc.redo();
  }
}
