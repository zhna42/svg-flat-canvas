import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { CadTextEngine, TextStylePatch } from '@/modules/text';
import { setEngineDefaultFont, getEngineDefaultFont } from '@/modules/text';

export class TextEditController {
  constructor(private canvas: SvgCanvas) {
    this.canvas.textEngine.onTextChanged = (elementId) => {
      this.canvas.events.emit('TEXT_CONTENT_CHANGED', { elementId });
    };
  }

  private get engine(): CadTextEngine {
    return this.canvas.textEngine;
  }

  async initTextFonts(apiKey: string): Promise<void> {
    await this.canvas.fonts.init(apiKey);
    const def = getEngineDefaultFont();
    await this.canvas.fonts.ensureLoaded(def.family, def.weight, 'normal');
    this.canvas.events.emit('FONTS_READY', {});
  }

  searchFonts(query = '', category?: string) {
    return this.canvas.fonts.search(query, category);
  }

  getFontVariants(family: string) {
    return this.canvas.fonts.getVariants(family);
  }

  activateTextTool(): void {
    this.canvas.creationHandler.setActiveType('text');
  }

  enterTextEdit(id: string): void {
    this.engine.enterEdit(id);
    this.canvas.events.emit('TEXT_EDIT_ENTER', { elementId: id });
  }

  exitTextEdit(): void {
    const id = this.engine.getEditingId();
    this.engine.exitEdit();
    if (id) this.canvas.events.emit('TEXT_EDIT_EXIT', { elementId: id });
  }

  isTextEditing(): boolean {
    return this.engine.isEditing;
  }

  async setTextStyle(patch: TextStylePatch): Promise<void> {
    const p = patch;
    if (p.fontFamily || p.fontWeight || p.italic || p.fontSize) {
      const el = this.engine.isEditing
        ? this.canvas.shapeManager.getById(this.engine.getEditingId()!)
        : null;
      const curFamily =
        p.fontFamily ??
        (el
          ? (el as import('@/core/shapes/elements/TextElement').TextElement)
              .defaultStyle.fontFamily
          : 'Roboto');
      const curWeight =
        p.fontWeight ??
        (el
          ? (el as import('@/core/shapes/elements/TextElement').TextElement)
              .defaultStyle.fontWeight
          : '400');
      const curItalic = p.italic
        ? 'italic'
        : el
          ? (el as import('@/core/shapes/elements/TextElement').TextElement)
              .defaultStyle.fontStyle
          : 'normal';
      this.canvas.events.emit('FONT_LOADING_START', {
        family: curFamily,
        weight: curWeight,
      });
      await this.canvas.fonts.ensureLoaded(curFamily, curWeight, curItalic);
      this.canvas.events.emit('FONT_LOADING_END', {
        family: curFamily,
        weight: curWeight,
      });
    }
    if (this.engine.isEditing) {
      this.engine.applyStyleToSelection(patch);
    } else {
      const ids = this.canvas.selectionState.selected
        .filter((e) => e.type === 'text')
        .map((e) => e.id);
      for (const id of ids) {
        const el = this.canvas.shapeManager.getById(id) as
          | import('@/core/shapes/elements/TextElement').TextElement
          | undefined;
        if (!el || !el.textModel || el.textModel.length === 0) continue;
        el.textModel = el.textModel.map((c) => {
          const styled = { ...c };
          if (p.fontFamily !== undefined) styled.fontFamily = p.fontFamily;
          if (p.fontWeight !== undefined) styled.fontWeight = p.fontWeight;
          if (p.italic !== undefined)
            styled.fontStyle = p.italic ? 'italic' : 'normal';
          if (p.fontSize !== undefined) styled.fontSize = p.fontSize;
          if (p.color !== undefined) styled.color = p.color;
          if (p.underline !== undefined) styled.underline = p.underline;
          if (p.strike !== undefined) styled.strike = p.strike;
          if (p.letterSpacing !== undefined)
            styled.letterSpacing = p.letterSpacing;
          return styled;
        });
      }
    }
    this.canvas.events.emit('TEXT_STYLE_CHANGED', { patch });
  }

  setTextFontSize(microns: number): Promise<void> {
    return this.setTextStyle({ fontSize: microns / 1000 });
  }

  setTextFontFamily(family: string): void {
    setEngineDefaultFont(family, '400');
    void this.setTextStyle({ fontFamily: family });
  }

  setTextWeight(weight: string): void {
    const cur = getEngineDefaultFont();
    setEngineDefaultFont(cur.family, weight);
    void this.setTextStyle({ fontWeight: weight });
  }

  setTextItalic(italic: boolean): void {
    void this.setTextStyle({ italic });
  }

  setTextColor(color: string): void {
    void this.setTextStyle({ color });
  }

  setTextUnderline(on: boolean): void {
    void this.setTextStyle({ underline: on });
  }

  setTextStrike(on: boolean): void {
    void this.setTextStyle({ strike: on });
  }

  setTextLetterSpacing(value: number): void {
    void this.setTextStyle({ letterSpacing: value });
  }

  setTextLineHeight(value: number): void {
    const ids = this.engine.isEditing
      ? [this.engine.getEditingId()!]
      : this.canvas.selectionState.selected
          .filter((e) => e.type === 'text')
          .map((e) => e.id);
    for (const id of ids) {
      const el = this.canvas.shapeManager.getById(id) as
        | import('@/core/shapes/elements/TextElement').TextElement
        | undefined;
      if (el) el.lineHeight = value;
    }
    this.canvas.events.emit('TEXT_STYLE_CHANGED', { patch: { lineHeight: value } });
  }

  setTextAlign(align: 'left' | 'center' | 'right'): void {
    const ids = this.engine.isEditing
      ? [this.engine.getEditingId()!]
      : this.canvas.selectionState.selected
          .filter((e) => e.type === 'text')
          .map((e) => e.id);
    for (const id of ids) {
      const el = this.canvas.shapeManager.getById(id) as
        | import('@/core/shapes/elements/TextElement').TextElement
        | undefined;
      if (el) el.align = align;
    }
    this.canvas.events.emit('TEXT_STYLE_CHANGED', { patch: { align } });
  }

  getText(id: string): string | null {
    return this.engine.getContent(id);
  }

  setText(id: string, html: string): void {
    const el = this.canvas.shapeManager.getById(id) as
      | import('@/core/shapes/elements/TextElement').TextElement
      | undefined;
    if (el) {
      el.textModel = [
        { ...el.defaultStyle, text: html.replace(/<[^>]*>/g, '') },
      ];
      this.canvas.events.emit('TEXT_CONTENT_CHANGED', { elementId: id });
    }
  }

  deleteTextCharacter(_direction: 'forward' | 'backward'): void {
    // Теперь все операции ввода идут через нативную textarea — клавиши Delete/Backspace не требуют программной эмуляции
  }

  undoTextEdit(): void {
    // Единый TimeMachine
  }

  redoTextEdit(): void {
    // Единый TimeMachine
  }
}
