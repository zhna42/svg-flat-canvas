/* eslint-disable custom-rules/no-dom-api */
export type TextAlign = 'left' | 'center' | 'right';

export interface TextBaseStyle {
  fontFamily: string;
  fontSizePx: number;
  color: string;
  fontWeight: string;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: TextAlign;
  lineHeight: number;
}

const ALLOWED_TAGS = new Set([
  'DIV',
  'SPAN',
  'BR',
  'B',
  'I',
  'U',
  'S',
  'STRONG',
  'EM',
]);
const ALLOWED_STYLE = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'color',
  'text-decoration',
];

/**
 * Санитизация HTML из contenteditable: оставляем только безопасные теги
 * и инлайновые стили шрифта/цвета/декора. Скрипты/атрибуты вырезаются.
 */
export function sanitizeTextHtml(html: string): string {
  if (typeof document === 'undefined') return stripTags(html);
  const tpl = document.createElement('div');
  tpl.innerHTML = html;
  cleanNode(tpl);
  return tpl.innerHTML;
}

function cleanNode(node: Element): void {
  const children = Array.from(node.children);
  for (const child of children) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      // Разворачиваем недопустимый тег в его содержимое.
      const parent = child.parentNode;
      if (parent) {
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
      }
      continue;
    }
    const style = (child as HTMLElement).style;
    const kept: string[] = [];
    for (const prop of ALLOWED_STYLE) {
      const v = style.getPropertyValue(prop);
      if (v) kept.push(`${prop}:${v}`);
    }
    for (const attr of Array.from(child.attributes)) {
      child.removeAttribute(attr.name);
    }
    if (kept.length) child.setAttribute('style', kept.join(';'));
    cleanNode(child);
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
