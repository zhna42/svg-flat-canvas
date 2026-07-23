/* eslint-disable custom-rules/no-dom-api */
import type { TextChunk } from '@/core/shapes/elements/TextElement';
import { MM_TO_PX } from '@/constants';

export interface LayoutSegment {
  chunkIndex: number;
  text: string;
  color: string;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  fontFamily: string;
  fontSize: number;
  underline: boolean;
  strike: boolean;
  letterSpacing: number;
  width: number;
}

export interface LayoutLine {
  segments: LayoutSegment[];
  width: number;
  maxFontSize: number;
}

export interface LayoutResult {
  lines: LayoutLine[];
}

let _measureCanvas: HTMLCanvasElement | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
  }
  return _measureCanvas.getContext('2d')!;
}

function measureSeg(ctx: CanvasRenderingContext2D, seg: LayoutSegment): number {
  const px = seg.fontSize * MM_TO_PX;
  const style = `${seg.fontStyle} ${seg.fontWeight} ${px}px "${seg.fontFamily}"`;
  ctx.font = style;
  return ctx.measureText(seg.text).width;
}

export function layoutText(model: TextChunk[], boxWidth: number): LayoutResult {
  const ctx = getMeasureCtx();
  const segments: LayoutSegment[] = flattenModel(model);
  return wrapIntoLines(segments, boxWidth, ctx);
}

function flattenModel(model: TextChunk[]): LayoutSegment[] {
  const result: LayoutSegment[] = [];
  for (let ci = 0; ci < model.length; ci++) {
    const c = model[ci];
    const style = {
      chunkIndex: ci,
      color: c.color,
      fontWeight: c.fontWeight,
      fontStyle: c.fontStyle,
      fontFamily: c.fontFamily,
      fontSize: c.fontSize,
      underline: c.underline,
      strike: c.strike,
      letterSpacing: c.letterSpacing,
      width: 0,
    };
    const lines = c.text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      if (lines[li].length > 0) {
        result.push({ ...style, text: lines[li] });
      }
      if (li < lines.length - 1) {
        result.push({ ...style, text: '\n' });
      }
    }
  }
  return result;
}

function wrapIntoLines(
  segments: LayoutSegment[],
  boxWidth: number,
  ctx: CanvasRenderingContext2D,
): LayoutResult {
  const lines: LayoutLine[] = [];
  let current: LayoutSegment[] = [];

  for (const seg of segments) {
    if (seg.text === '\n') {
      lines.push(buildLine(current, ctx));
      current = [];
      continue;
    }

    const words = splitWords(seg.text);
    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const testSeg: LayoutSegment = { ...seg, text: word };
      const wordWidth = measureSeg(ctx, testSeg);

      const lineWidth = current.reduce((s, s2) => s + measureSeg(ctx, s2), 0);

      if (
        current.length > 0 &&
        lineWidth + wordWidth > boxWidth &&
        !isWs(word)
      ) {
        lines.push(buildLine(current, ctx));
        current = [];
      }

      current.push(testSeg);
    }
  }

  if (current.length > 0 || lines.length === 0) {
    lines.push(buildLine(current, ctx));
  }

  if (lines.length === 0) {
    lines.push({ segments: [], width: 0, maxFontSize: 16 });
  }

  return { lines };
}

function splitWords(text: string): string[] {
  const parts: string[] = [];
  let buf = '';
  for (const ch of text) {
    if (ch === ' ' || ch === '\u00A0') {
      if (buf) parts.push(buf);
      parts.push(ch);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

function isWs(s: string): boolean {
  return s === ' ' || s === '\u00A0';
}

function buildLine(
  segments: LayoutSegment[],
  ctx: CanvasRenderingContext2D,
): LayoutLine {
  let width = 0;
  let maxFontSize = 0;
  for (const seg of segments) {
    seg.width = measureSeg(ctx, seg);
    width += seg.width;
    if (seg.fontSize > maxFontSize) maxFontSize = seg.fontSize;
  }
  return { segments, width, maxFontSize: maxFontSize || 16 };
}

export function getCharIndex(
  lines: LayoutLine[],
  lineIndex: number,
  column: number,
): number {
  let offset = 0;
  for (let l = 0; l < lineIndex && l < lines.length; l++) {
    offset += lines[l].segments.reduce((s, seg) => s + seg.text.length, 0);
  }
  return offset + column;
}
