/* eslint-disable custom-rules/no-dom-api */
import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { TextElement } from '@/core/shapes/elements/TextElement';
import { PathElement } from '@/core/shapes/elements/PathElement';
import { layoutText } from '@/modules/text/TextLayout';
import { MM_TO_PX } from '@/constants';

let _idCounter = 0;
const genId = (): string =>
  crypto.randomUUID?.() ?? `text2path_${Date.now()}_${++_idCounter}`;

let _worker: Worker | null = null;

function getWorker(): Worker {
  if (!_worker) {
    const code = `
      importScripts('https://unpkg.com/opentype.js@1.3.4/dist/opentype.min.js');
      self.onmessage = function(e) {
        if (e.data.type !== 'CONVERT') return;
        var id = e.data.id;
        var segments = e.data.segments;
        var fontBuffers = e.data.fontBuffers;
        var allPaths = [];
        for (var i = 0; i < segments.length; i++) {
          var seg = segments[i];
          var key = seg.fontFamily + '|' + seg.fontWeight + '|' + seg.fontStyle;
          var buf = fontBuffers[key];
          if (!buf) continue;
          try {
            var font = opentype.parse(buf);
            var text = seg.text;
            var x = seg.lineX;
            var y = seg.lineY;
            var fs = seg.fontSize;
            for (var ci = 0; ci < text.length; ci++) {
              var ch = text[ci];
              var gid = 0;
              try { gid = font.charToGlyphIndex(ch); } catch(_) {}
              if (gid > 0) {
                var path = font.getPath(ch, x, y, fs, { kerning: true });
                var d = path.toPathData(1);
                d = d.replace(/(\\d)-/g, '$1 -');
                if (d.indexOf('undefined') < 0) {
                  allPaths.push(d);
                }
              }
              try { x += font.getAdvanceWidth(ch, fs); } catch(_) {
                x += fs * 0.6;
              }
            }
          } catch(ex) {
            console.error('[T2P Worker] error:', ex);
          }
        }
        self.postMessage({
          type: 'RESULT',
          id: id,
          pathData: allPaths.length > 0 ? allPaths.join(' ') : null
        });
      };
    `;
    _worker = new Worker(
      URL.createObjectURL(new Blob([code], { type: 'text/javascript' })),
    );
  }
  return _worker;
}

export class TextToPathController {
  private readonly canvas: SvgCanvas;

  constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  async convertSelected(): Promise<void> {
    const selected = this.canvas.selectionState.selected;
    const textEl = selected.find((el): el is TextElement => el.type === 'text');
    if (!textEl) {
      console.warn('[TextToPath] No text element selected');
      return;
    }

    if (!this.canvas.fonts.isReady) {
      console.warn('[TextToPath] Fonts not initialized yet');
      return;
    }

    const result = await this._textToPath(textEl);
    if (!result) {
      console.warn('[TextToPath] No path generated');
      return;
    }

    const id = genId();
    const el = new PathElement(id);

    el.d = result;
    const firstChunk = textEl.textModel[0];
    el.style.fill = firstChunk?.color || '#000000';
    el.style.stroke = 'none';
    el.isSimpleHitArea = true;

    el.transform.translate(textEl.boxX, textEl.boxY);
    el.rebuildHitArea();
    el.clearTimeMachineDiff();

    this.canvas.shapeManager.removeElementAndNode(textEl.id);
    this.canvas.elementManager.addShape(el);
    this.canvas.selectionState.replace([el]);
  }

  private async _textToPath(el: TextElement): Promise<string | null> {
    const fonts = this.canvas.fonts;

    const fontBuffers: Record<string, ArrayBuffer> = {};
    for (const c of el.textModel) {
      const key = `${c.fontFamily}|${c.fontWeight}|${c.fontStyle}`;
      if (fontBuffers[key]) continue;
      await fonts.ensureLoaded(c.fontFamily, c.fontWeight, c.fontStyle);
      const buf = await fonts.getFontBuffer(
        c.fontFamily,
        c.fontWeight,
        c.fontStyle,
      );
      if (buf) {
        fontBuffers[key] = buf;
      } else {
        console.warn(
          `[TextToPath] Font not available: ${c.fontFamily}. Select a Google Font first.`,
        );
      }
    }

    if (Object.keys(fontBuffers).length === 0) return null;

    const layout = layoutText(el.textModel, el.boxWidth);
    const segments: Array<{
      chunkIndex: number;
      text: string;
      fontSize: number;
      lineX: number;
      lineY: number;
      fontFamily: string;
      fontWeight: string;
      fontStyle: string;
    }> = [];

    let lineY = 0;
    for (const line of layout.lines) {
      let lineX = 0;
      for (const seg of line.segments) {
        if (!seg.text.trim()) continue;
        segments.push({
          chunkIndex: seg.chunkIndex,
          text: seg.text,
          fontSize: seg.fontSize * MM_TO_PX,
          lineX,
          lineY,
          fontFamily: seg.fontFamily,
          fontWeight: seg.fontWeight,
          fontStyle: seg.fontStyle,
        });
        lineX += Number.isFinite(seg.width)
          ? seg.width
          : seg.fontSize * MM_TO_PX * seg.text.length * 0.6;
      }
      lineY += (line.maxFontSize || 4) * el.lineHeight * MM_TO_PX;
    }

    const worker = getWorker();
    const msgId = genId();

    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'RESULT' && e.data?.id === msgId) {
          worker.removeEventListener('message', handler);
          resolve(e.data.pathData as string | null);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'CONVERT',
        id: msgId,
        segments,
        fontBuffers,
      });
    });
  }
}
