/* eslint-disable custom-rules/no-dom-api */
import type { Camera } from '@/canvas/Camera';
import type { CanvasView } from '@/canvas/CanvasView';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import { FontService, type FontStyle } from './FontService';
import { sanitizeTextHtml, type TextAlign } from './text-types';
import { TextTimeMachine } from './TextTimeMachine';

type TextEl = {
  type: string;
  rich?: boolean;
  textContent: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: string;
  color: string;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: string;
  lineHeight: string;
  convertToRich?: (b: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  setTextContent?: (t: string) => void;
};

function isText(el: unknown): el is TextEl {
  return !!(el && (el as TextEl).type === 'text');
}

export interface TextControllerDeps {
  svg: SVGSVGElement;
  camera: Camera;
  view: CanvasView;
  getElement: (id: string) => AbstractGraphicElement | undefined;
  hitTest: (x: number, y: number) => string[];
  deleteElement: (id: string) => void;
  emit: (type: string, data: unknown) => void;
}

export interface TextStylePatch {
  fontFamily?: string;
  fontWeight?: string;
  italic?: boolean;
  fontSizePx?: number;
  color?: string;
  underline?: boolean;
  strike?: boolean;
  align?: TextAlign;
  lineHeight?: number;
}

export class TextController {
  public readonly fonts = new FontService();
  private deps: TextControllerDeps;
  private editingId: string | null = null;
  private inputHandler: (() => void) | null = null;
  private tm: TextTimeMachine | null = null;

  constructor(deps: TextControllerDeps) {
    this.deps = deps;
  }

  public get isEditing(): boolean {
    return this.editingId !== null;
  }
  public getEditingId(): string | null {
    return this.editingId;
  }

  // ── Вход/выход правки ──

  public enterEdit(id: string): void {
    const el = this.deps.getElement(id);
    const textEl = isText(el) ? el : null;
    if (!textEl) return;
    if (this.editingId && this.editingId !== id) this.exitEdit();

    if (!textEl.rich && textEl.convertToRich) {
      const bbox = this.deps.view.measureTextBBox(id) ?? {
        x: 0,
        y: 0,
        width: 200,
        height: 40,
      };
      textEl.convertToRich(bbox);
    }
    this.editingId = id;

    // Машина времени
    const initial = textEl.textContent ?? '';
    this.tm = new TextTimeMachine(initial, (html) => {
      const div = this.deps.view.getTextDiv(id);
      if (div) {
        div.innerHTML = html;
        this.syncFromDiv(id, div);
      }
    });

    setTimeout(() => this.focusWhenReady(id, 0), 0);
    this.deps.emit('TEXT_EDIT_ENTERED', { id });
  }

  private focusWhenReady(id: string, attempt: number): void {
    const div = this.deps.view.getTextDiv(id);
    if (!div) {
      if (attempt < 30)
        requestAnimationFrame(() => this.focusWhenReady(id, attempt + 1));
      return;
    }
    div.setAttribute('contenteditable', 'true');
    div.focus();
    this.placeCaretEnd(div);
    this.inputHandler = (): void => this.syncFromDiv(id, div);
    div.addEventListener('input', this.inputHandler);
    div.addEventListener('mouseup', () => this.emitSelectionStyle());
    div.addEventListener('keyup', () => this.emitSelectionStyle());
    div.addEventListener('blur', () => {
      // При потере фокуса, если контент пуст — выходим.
      if (!div.textContent?.trim() && this.editingId) {
        this.exitEdit();
      }
    });
  }

  public exitEdit(): void {
    if (!this.editingId) return;
    const id = this.editingId;
    const el = this.deps.getElement(id);
    const div = this.deps.view.getTextDiv(id);
    if (div) {
      if (this.inputHandler)
        div.removeEventListener('input', this.inputHandler);
      div.removeAttribute('contenteditable');
      const html = sanitizeTextHtml(div.innerHTML);
      if (isText(el)) el.textContent = html;
    }
    this.editingId = null;
    this.inputHandler = null;
    this.tm = null;

    if (isText(el) && isEmptyHtml(el.textContent)) {
      this.deps.deleteElement(id);
    }
    this.deps.emit('TEXT_EDIT_EXITED', { id });
  }

  private syncFromDiv(id: string, div: HTMLDivElement): void {
    const el = this.deps.getElement(id);
    if (isText(el)) {
      el.textContent = div.innerHTML;
    }
    this.deps.emit('TEXT_CONTENT_CHANGED', { id });
  }

  /** Удалить символ в направлении каретки. */
  public deleteCharacter(direction: 'forward' | 'backward'): void {
    if (!this.editingId) return;
    const div = this.deps.view.getTextDiv(this.editingId);
    if (!div) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      document.execCommand('delete');
    } else if (direction === 'backward') {
      document.execCommand('delete');
    } else {
      document.execCommand('forwardDelete');
    }
    this.syncFromDiv(this.editingId, div);
    this.tm?.capture(div.innerHTML);
  }

  /** Шаг назад (локальная машина времени). */
  public undo(): void {
    this.tm?.undo();
  }
  /** Шаг вперёд. */
  public redo(): void {
    this.tm?.redo();
  }

  // ── InputHandler (клик вне рамки = применить) ──

  public onMouseDown(e: MouseEvent): boolean {
    if (!this.editingId || e.button !== 0) return false;
    const world = this.eventToWorld(e);
    const hits = this.deps.hitTest(world.x, world.y);
    if (hits.includes(this.editingId)) return false;
    this.exitEdit();
    return false;
  }

  public onKeyDown(e: KeyboardEvent): boolean {
    if (!this.editingId) return false;
    if (e.key === 'Escape') {
      this.exitEdit();
      return true;
    }
    return false;
  }

  // ── Применение стиля ──

  public async applyStyle(patch: TextStylePatch): Promise<void> {
    const family = patch.fontFamily;
    const weight = patch.fontWeight;
    const style: FontStyle = patch.italic ? 'italic' : 'normal';
    if (family || weight || patch.italic !== undefined) {
      await this.fonts.ensureLoaded(
        family ?? this.currentFamily(),
        weight ?? '400',
        style,
      );
    }

    if (this.editingId) {
      const div = this.deps.view.getTextDiv(this.editingId);
      if (div) this.applyRangeStyle(div, patch);
      this.applyWholeStyle(this.editingId, patch, false);
      this.emitSelectionStyle();
    } else {
      for (const id of this.selectedTextIds())
        this.applyWholeStyle(id, patch, true);
    }
  }

  private applyWholeStyle(
    id: string,
    p: TextStylePatch,
    flatten: boolean,
  ): void {
    const el = this.deps.getElement(id);
    if (!isText(el)) return;
    if (p.fontFamily !== undefined) el.fontFamily = p.fontFamily;
    if (p.fontWeight !== undefined) el.fontWeight = p.fontWeight;
    if (p.italic !== undefined) el.italic = p.italic;
    if (p.fontSizePx !== undefined) el.fontSize = String(p.fontSizePx);
    if (p.color !== undefined) el.color = p.color;
    if (p.underline !== undefined) el.underline = p.underline;
    if (p.strike !== undefined) el.strike = p.strike;
    if (p.align !== undefined) el.align = p.align;
    if (p.lineHeight !== undefined) el.lineHeight = String(p.lineHeight);
    if (flatten) el.textContent = flattenSpans(el.textContent);
  }

  private applyRangeStyle(div: HTMLDivElement, p: TextStylePatch): void {
    const css: Record<string, string> = {};
    if (p.fontFamily) css['font-family'] = p.fontFamily;
    if (p.fontWeight) css['font-weight'] = p.fontWeight;
    if (p.italic !== undefined)
      css['font-style'] = p.italic ? 'italic' : 'normal';
    if (p.fontSizePx !== undefined) css['font-size'] = `${p.fontSizePx}px`;
    if (p.color) css.color = p.color;
    if (p.underline !== undefined || p.strike !== undefined) {
      const parts: string[] = [];
      if (p.underline) parts.push('underline');
      if (p.strike) parts.push('line-through');
      css['text-decoration'] = parts.length ? parts.join(' ') : 'none';
    }
    if (Object.keys(css).length === 0) return;
    wrapSelection(css);
    const id = this.editingId;
    if (id) this.syncFromDiv(id, div);
  }

  private emitSelectionStyle(): void {
    if (!this.editingId) return;
    this.deps.emit('TEXT_SELECTION_CHANGED', { id: this.editingId });
  }

  public getContent(id: string): string | null {
    const el = this.deps.getElement(id);
    return isText(el) ? el.textContent : null;
  }
  public setContent(id: string, html: string): void {
    const el = this.deps.getElement(id);
    if (isText(el)) el.textContent = sanitizeTextHtml(html);
  }

  // ── helpers ──

  private currentFamily(): string {
    const id = this.editingId ?? this.selectedTextIds()[0];
    const el = id ? this.deps.getElement(id) : undefined;
    return isText(el) ? el.fontFamily : '';
  }

  private selectedTextIds(): string[] {
    return this._selectedTextIds ? this._selectedTextIds() : [];
  }
  public _selectedTextIds: (() => string[]) | null = null;

  private placeCaretEnd(div: HTMLDivElement): void {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  private eventToWorld(e: MouseEvent): { x: number; y: number } {
    const pt = this.deps.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = this.deps.svg.getScreenCTM();
    const p = ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    return this.deps.camera.screenToWorld({ x: p.x, y: p.y });
  }
}

function wrapSelection(css: Record<string, string>): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;
  const span = document.createElement('span');
  for (const [k, v] of Object.entries(css)) span.style.setProperty(k, v);
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.addRange(r);
}

function flattenSpans(html: string): string {
  return html.replace(/<(?!br\s*\/?>)[^>]+>/gi, '');
}

function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length === 0;
}
