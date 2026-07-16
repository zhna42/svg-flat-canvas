import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { TextElement } from '@/core/shapes/elements/TextElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import opentype from 'opentype.js';

let _idCounter = 0;
const genId = (): string =>
  crypto.randomUUID?.() ?? `text2path_${Date.now()}_${++_idCounter}`;

export class TextToPathController {
  private readonly canvas: SvgCanvas;

  constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  async convertSelected(): Promise<void> {
    const selected = this.canvas.selectionState.selected;
    const textEl = selected.find(
      (el): el is TextElement => el.type === 'text',
    );
    if (!textEl) return;

    const text = textEl.textContent || '';
    const family = textEl.fontFamily || '';
    const fontWeight = textEl.fontWeight || '400';
    const fontSize = Number(textEl.fontSize) || 72;

    if (!text || !family) return;

    const d = await this._textToPath(text, family, fontWeight, fontSize);
    if (!d) return;

    const bbox = textEl.getTransformedBBox();
    const id = genId();
    const el = new PathElement(id);

    // Устанавливаем path data (parseD парсит с фиксом пробелов)
    el.d = d;
    el.style.fill = textEl.color || '#000000';
    el.style.stroke = 'none';
    el.isSimpleHitArea = true;

    // Позиционируем по bbox текста
    el.transform.translate(bbox.x, bbox.y);
    el.rebuildHitArea();
    el.clearTimeMachineDiff();

    this.canvas.shapeManager.removeElementAndNode(textEl.id);
    this.canvas.elementManager.addShape(el);
    this.canvas.selectionState.replace([el]);
  }

  private async _textToPath(
    text: string,
    family: string,
    weight: string,
    fontSize: number,
  ): Promise<string> {
    const fs = this.canvas.textController.fonts;
    if (!fs.isReady) return '';

    const buf = await fs.getFontBuffer(family, weight, 'normal');
    if (!buf) {
      console.warn('[TextToPath] Font buffer not found:', family, weight);
      return '';
    }

    try {
      const font = opentype.parse(buf);
      const path = font.getPath(text, 0, 0, fontSize * 1000, { kerning: true });
      let d = path.toPathData(1);
      d = d.replace(/(\d)-/g, '$1 -');
      return d;
    } catch (e) {
      console.warn('[TextToPath] opentype error:', e);
      return '';
    }
  }
}
