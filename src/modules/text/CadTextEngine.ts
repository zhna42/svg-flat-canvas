/* eslint-disable custom-rules/no-dom-api */
import type {
  TextElement,
  TextChunk,
} from '@/core/shapes/elements/TextElement';
import type { Camera } from '@/canvas/Camera';
import { FontService } from './FontService';
import { MM_TO_PX } from '@/constants';

let _defaultFontFamily = 'Roboto';
let _defaultFontWeight = '400';

export function setEngineDefaultFont(family: string, weight: string): void {
  _defaultFontFamily = family;
  _defaultFontWeight = weight;
}

export function getEngineDefaultFont(): {
  family: string;
  weight: string;
} {
  return { family: _defaultFontFamily, weight: _defaultFontWeight };
}

export interface TextStylePatch {
  fontFamily?: string;
  fontWeight?: string;
  italic?: boolean;
  fontSize?: number;
  color?: string;
  underline?: boolean;
  strike?: boolean;
  letterSpacing?: number;
}

interface CadTextEngineDeps {
  svg: SVGSVGElement;
  camera: Camera;
  fonts: FontService;
  getTextElement: (id: string) => TextElement | undefined;
  getTextSvg: (id: string) => SVGElement | undefined;
  deleteElement: (id: string) => void;
  hitTest: (x: number, y: number) => string[];
  onUndo: () => void;
  onRedo: () => void;
  clearSelection?: () => void;
}

export class CadTextEngine {
  public readonly fonts: FontService;
  private deps: CadTextEngineDeps;
  private editingId: string | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private oldFullText = '';
  private mouseAnchor = -1;

  public onTextChanged: ((elementId: string) => void) | null = null;

  constructor(deps: CadTextEngineDeps) {
    this.deps = deps;
    this.fonts = deps.fonts;
    this._createHiddenTextarea();
  }

  public get isEditing(): boolean {
    return this.editingId !== null;
  }

  public getEditingId(): string | null {
    return this.editingId;
  }

  private _createHiddenTextarea(): void {
    const ta = document.createElement('textarea');
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('spellcheck', 'false');
    ta.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;resize:none;z-index:-1;background:transparent;border:none;outline:none;color:transparent;caret-color:transparent;';
    document.body.appendChild(ta);
    this.textarea = ta;
  }

  public enterEdit(id: string): void {
    if (this.editingId && this.editingId !== id) this.exitEdit();
    const el = this.deps.getTextElement(id);
    if (!el) return;

    this.editingId = id;
    const ft = el.fullText;
    this.oldFullText = ft;

    el.editing = true;
    el.caretIdx = ft.length;
    el.selStart = -1;
    el.selEnd = -1;

    const ta = this.textarea!;
    ta.value = ft;
    ta.focus();
    ta.setSelectionRange(ft.length, ft.length);

    ta.addEventListener('input', this._onInput);
    ta.addEventListener('keyup', this._onKeyUp);
    ta.addEventListener('keydown', this._onTAreaKeyDown);

    document.addEventListener('selectionchange', this._onDocSelectionChange);
    window.addEventListener('mousedown', this._onWindowMouseDown, true);
  }

  public exitEdit(): void {
    if (!this.editingId) return;
    this.deps.clearSelection?.();
    const id = this.editingId;

    const el = this.deps.getTextElement(id);
    if (el) {
      el.editing = false;
      el.caretIdx = -1;
      el.selStart = -1;
      el.selEnd = -1;
      (el as any).pushDiffRendering?.((el as any)._rootProxy ?? el);
    }

    const ta = this.textarea!;
    ta.removeEventListener('input', this._onInput);
    ta.removeEventListener('keyup', this._onKeyUp);
    ta.removeEventListener('keydown', this._onTAreaKeyDown);

    document.removeEventListener('selectionchange', this._onDocSelectionChange);
    window.removeEventListener('mousedown', this._onWindowMouseDown, true);

    ta.blur();
    this.editingId = null;
    this.oldFullText = '';
    this.mouseAnchor = -1;

    if (el && el.fullText.trim() === '') {
      this.deps.deleteElement(id);
    }
  }

  private _onInput = (): void => {
    if (!this.editingId) return;
    const el = this.deps.getTextElement(this.editingId);
    if (!el) return;

    const newText = this.textarea!.value;
    const oldText = this.oldFullText;
    if (newText === oldText) return;

    const commonPrefix = longestCommonPrefix(oldText, newText);
    const commonSuffix = longestCommonSuffix(oldText, newText, commonPrefix);
    const oldDelStart = commonPrefix;
    const oldDelEnd = oldText.length - commonSuffix;
    const inserted = newText.slice(commonPrefix, newText.length - commonSuffix);

    const newModel = applyTextEdit(
      el.textModel,
      oldDelStart,
      oldDelEnd,
      inserted,
    );
    el.textModel = newModel;
    this.oldFullText = newText;

    el.caretIdx = this.textarea!.selectionStart ?? newText.length;
    this.onTextChanged?.(this.editingId);
    el.selStart = -1;
    el.selEnd = -1;
  };

  private _onKeyUp = (): void => {
    if (!this.editingId) return;
    const el = this.deps.getTextElement(this.editingId);
    if (!el) return;

    const ta = this.textarea!;
    const ss = ta.selectionStart;
    const se = ta.selectionEnd;

    if (ss === se) {
      el.caretIdx = ss;
      el.selStart = -1;
      el.selEnd = -1;
    } else {
      el.caretIdx = -1;
      el.selStart = Math.min(ss, se);
      el.selEnd = Math.max(ss, se);
    }
  };

  private _onDocSelectionChange = (): void => {
    if (document.activeElement !== this.textarea || !this.editingId) return;
    const el = this.deps.getTextElement(this.editingId);
    if (!el) return;

    const ta = this.textarea!;
    const ss = ta.selectionStart;
    const se = ta.selectionEnd;

    if (ss === se) {
      el.caretIdx = ss;
      el.selStart = -1;
      el.selEnd = -1;
    } else {
      el.caretIdx = -1;
      el.selStart = Math.min(ss, se);
      el.selEnd = Math.max(ss, se);
    }
  };

  private _onTAreaKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.exitEdit();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.deps.onUndo();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      this.deps.onRedo();
    }
  };

  public applyStyleToSelection(patch: TextStylePatch): void {
    const el = this.editingId ? this.deps.getTextElement(this.editingId) : null;
    if (!el || !this.textarea) return;

    const ss =
      this.textarea.selectionStart !== this.textarea.selectionEnd ||
      el.selStart < 0
        ? this.textarea.selectionStart
        : el.selStart;
    const se =
      this.textarea.selectionStart !== this.textarea.selectionEnd ||
      el.selEnd < 0
        ? this.textarea.selectionEnd
        : el.selEnd;

    if (ss === se) {
      el.textModel = el.textModel.map((c) => {
        const styled = { ...c };
        if (patch.fontFamily !== undefined)
          styled.fontFamily = patch.fontFamily;
        if (patch.fontWeight !== undefined)
          styled.fontWeight = patch.fontWeight;
        if (patch.italic !== undefined)
          styled.fontStyle = patch.italic ? 'italic' : 'normal';
        if (patch.fontSize !== undefined) styled.fontSize = patch.fontSize;
        if (patch.color !== undefined) styled.color = patch.color;
        if (patch.underline !== undefined) styled.underline = patch.underline;
        if (patch.strike !== undefined) styled.strike = patch.strike;
        if (patch.letterSpacing !== undefined)
          styled.letterSpacing = patch.letterSpacing;
        return styled;
      });
    } else {
      el.textModel = applyRangeStyle(
        el.textModel,
        Math.min(ss, se),
        Math.max(ss, se),
        patch,
      );
    }
  }

  public getContent(id: string): string | null {
    const el = this.deps.getTextElement(id);
    return el ? el.fullText : null;
  }

  public onMouseDown(e: MouseEvent): boolean {
    if (!this.editingId || e.button !== 0) return false;

    const world = this._eventToWorld(e);
    const el = this.deps.getTextElement(this.editingId);
    if (!el) return false;

    const idx = this._worldToCharIdx(el, world.x, world.y);
    if (idx < 0) {
      this.exitEdit();
      return false;
    }

    const ta = this.textarea!;
    ta.setSelectionRange(idx, idx);
    ta.focus();
    this.mouseAnchor = idx;
    el.caretIdx = idx;
    el.selStart = -1;
    el.selEnd = -1;

    return true;
  }

  private _onWindowMouseDown = (e: MouseEvent): void => {
    console.log('[TEXT] window mousedown capture, editingId:', this.editingId, 'target:', e.target, 'svg:', this.deps.svg, 'contains:', this.deps.svg.contains(e.target as Node));
    if (!this.editingId) return;
    if (!this.deps.svg.contains(e.target as Node)) return;
    console.log('[TEXT] exitEdit via window click');
    this.exitEdit();
  };

  public onMouseMove(e: MouseEvent): boolean {
    if (!this.editingId || this.mouseAnchor < 0) return false;
    if (e.buttons !== 1) {
      this.mouseAnchor = -1;
      return false;
    }

    const world = this._eventToWorld(e);
    const el = this.deps.getTextElement(this.editingId);
    if (!el) return false;

    const idx = this._worldToCharIdx(el, world.x, world.y);
    if (idx < 0) return false;

    const start = Math.min(this.mouseAnchor, idx);
    const end = Math.max(this.mouseAnchor, idx);

    const ta = this.textarea!;
    ta.setSelectionRange(start, end);
    el.caretIdx = -1;
    el.selStart = start;
    el.selEnd = end;

    return true;
  }

  public onMouseUp(_e: MouseEvent): boolean {
    if (!this.editingId) return false;
    this.mouseAnchor = -1;
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

  private _worldToCharIdx(
    el: TextElement,
    worldX: number,
    worldY: number,
  ): number {
    if (el.textModel.length === 0) return 0;

    const fullText = el.fullText;
    if (fullText.length === 0) return 0;

    const localY = worldY - el.boxY;
    if (localY < 0 || localY > el.boxHeight) return -1;

    const textSvg = this.editingId
      ? this.deps.getTextSvg(this.editingId)
      : undefined;

    if (!textSvg || !(textSvg as unknown as SVGGraphicsElement).getCTM) {
      return this._roughCharIdx(worldX, worldY, el, fullText);
    }

    const g = textSvg as unknown as SVGGraphicsElement;
    const ctm = g.getCTM();
    if (!ctm) return this._roughCharIdx(worldX, worldY, el, fullText);

    const pt = this.deps.svg.createSVGPoint();
    pt.x = worldX;
    pt.y = worldY;
    const local = pt.matrixTransform(ctm.inverse());

    const fullLen = (textSvg.textContent ?? '').length;
    if (fullLen === 0) return 0;

    const getExtent = (
      textSvg as unknown as {
        getExtentOfChar?: (i: number) => {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }
    ).getExtentOfChar;

    if (typeof getExtent !== 'function') {
      return this._roughCharIdx(worldX, worldY, el, fullText);
    }

    for (let i = 0; i < fullLen; i++) {
      try {
        const ext = getExtent(i);
        if (
          local.x >= ext.x &&
          local.x <= ext.x + ext.width &&
          local.y >= ext.y &&
          local.y <= ext.y + ext.height
        ) {
          return local.x < ext.x + ext.width / 2 ? i : i + 1;
        }
      } catch {
        continue;
      }
    }

    const lastExt = (() => {
      try {
        return getExtent(fullLen - 1);
      } catch {
        return null;
      }
    })();

    if (lastExt && local.x > lastExt.x + lastExt.width) {
      return fullText.length;
    }
    if (lastExt && local.x < lastExt.x) {
      return 0;
    }

    return this._roughCharIdx(worldX, worldY, el, fullText);
  }

  private _roughCharIdx(
    worldX: number,
    _worldY: number,
    el: TextElement,
    fullText: string,
  ): number {
    const localX = worldX - el.boxX;
    if (localX < 0) return 0;
    if (localX > el.boxWidth) return fullText.length;

    const fs = el.defaultStyle.fontSize * MM_TO_PX;
    const charEst = fs * 0.5;
    const idx = Math.round(localX / charEst);
    return Math.max(0, Math.min(idx, fullText.length));
  }

  private _eventToWorld(e: MouseEvent): { x: number; y: number } {
    const pt = this.deps.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = this.deps.svg.getScreenCTM();
    const p = ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    return this.deps.camera.screenToWorld({ x: p.x, y: p.y });
  }
}

function longestCommonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function longestCommonSuffix(a: string, b: string, prefixLen: number): number {
  let i = 0;
  while (
    i < a.length - prefixLen &&
    i < b.length - prefixLen &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  )
    i++;
  return i;
}

function applyTextEdit(
  model: TextChunk[],
  delStart: number,
  delEnd: number,
  inserted: string,
): TextChunk[] {
  if (model.length === 0) {
    if (inserted.length > 0) {
      const def = defaultChunk();
      return [{ ...def, text: inserted }];
    }
    return [];
  }

  const beforeChunks: TextChunk[] = [];
  const afterChunks: TextChunk[] = [];
  let offset = 0;

  for (const chunk of model) {
    const chunkEnd = offset + chunk.text.length;
    if (chunkEnd <= delStart) {
      beforeChunks.push({ ...chunk });
    } else if (offset >= delEnd) {
      afterChunks.push({ ...chunk });
    } else {
      const localStart = Math.max(0, delStart - offset);
      const localEnd = Math.min(chunk.text.length, delEnd - offset);
      const beforeText = chunk.text.slice(0, localStart);
      const afterText = chunk.text.slice(localEnd);
      if (beforeText) beforeChunks.push({ ...chunk, text: beforeText });
      if (afterText) afterChunks.push({ ...chunk, text: afterText });
    }
    offset = chunkEnd;
  }

  const styleAt = getStyleAt(model, delStart);
  const result = beforeChunks;

  if (inserted.length > 0) {
    const prev = result.length > 0 ? result[result.length - 1] : null;
    if (
      prev &&
      prev.color === styleAt.color &&
      prev.fontWeight === styleAt.fontWeight &&
      prev.fontStyle === styleAt.fontStyle &&
      prev.fontFamily === styleAt.fontFamily &&
      prev.fontSize === styleAt.fontSize &&
      prev.underline === styleAt.underline &&
      prev.strike === styleAt.strike &&
      prev.letterSpacing === styleAt.letterSpacing
    ) {
      prev.text += inserted;
    } else {
      result.push({ ...styleAt, text: inserted });
    }
  }

  for (const c of afterChunks) result.push(c);
  return compactChunks(result);
}

function applyRangeStyle(
  model: TextChunk[],
  start: number,
  end: number,
  patch: TextStylePatch,
): TextChunk[] {
  const result: TextChunk[] = [];
  let offset = 0;

  for (const chunk of model) {
    const chunkEnd = offset + chunk.text.length;
    if (chunkEnd <= start || offset >= end) {
      result.push({ ...chunk });
    } else {
      const s = Math.max(start - offset, 0);
      const e = Math.min(end - offset, chunk.text.length);
      const before = chunk.text.slice(0, s);
      const selected = chunk.text.slice(s, e);
      const after = chunk.text.slice(e);

      if (before) result.push({ ...chunk, text: before });
      if (selected) {
        const styled = { ...chunk, text: selected };
        if (patch.fontFamily !== undefined)
          styled.fontFamily = patch.fontFamily;
        if (patch.fontWeight !== undefined)
          styled.fontWeight = patch.fontWeight;
        if (patch.italic !== undefined)
          styled.fontStyle = patch.italic ? 'italic' : 'normal';
        if (patch.fontSize !== undefined) styled.fontSize = patch.fontSize;
        if (patch.color !== undefined) styled.color = patch.color;
        if (patch.underline !== undefined) styled.underline = patch.underline;
        if (patch.strike !== undefined) styled.strike = patch.strike;
        if (patch.letterSpacing !== undefined)
          styled.letterSpacing = patch.letterSpacing;
        result.push(styled);
      }
      if (after) result.push({ ...chunk, text: after });
    }
    offset = chunkEnd;
  }

  return compactChunks(result);
}

function compactChunks(chunks: TextChunk[]): TextChunk[] {
  if (chunks.length <= 1) return chunks;
  const result: TextChunk[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = result[result.length - 1];
    const cur = chunks[i];
    if (cur.text === '') continue;
    if (
      prev.color === cur.color &&
      prev.fontWeight === cur.fontWeight &&
      prev.fontStyle === cur.fontStyle &&
      prev.fontFamily === cur.fontFamily &&
      prev.fontSize === cur.fontSize &&
      prev.underline === cur.underline &&
      prev.strike === cur.strike &&
      prev.letterSpacing === cur.letterSpacing
    ) {
      prev.text += cur.text;
    } else {
      result.push({ ...cur });
    }
  }
  return result;
}

function defaultChunk(): TextChunk {
  return {
    text: '',
    color: '#000000',
    fontWeight: _defaultFontWeight,
    fontStyle: 'normal',
    fontFamily: _defaultFontFamily,
    fontSize: 4,
    underline: false,
    strike: false,
    letterSpacing: 0,
  };
}

function getStyleAt(model: TextChunk[], pos: number): TextChunk {
  let offset = 0;
  for (const chunk of model) {
    const chunkEnd = offset + chunk.text.length;
    if (pos >= offset && pos <= chunkEnd) return { ...chunk, text: '' };
    offset = chunkEnd;
  }
  if (model.length > 0) return { ...model[model.length - 1], text: '' };
  return defaultChunk();
}
