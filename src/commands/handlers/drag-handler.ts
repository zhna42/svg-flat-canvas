import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { CommandHistory } from '../CommandHistory';

export interface DragHandlerContext {
  getElements: () => SvgElement[];
  history: CommandHistory;
  onDragEnd?: (elementIds: string[]) => void;
}

function extractElementProperties(el: SvgElement): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  const attrNames = [
    'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
    'width', 'height',
    'x1', 'y1', 'x2', 'y2',
    'd', 'points',
    'fill', 'stroke', 'stroke-width', 'opacity',
    'transform',
  ];
  for (const name of attrNames) {
    const v = el.element.getAttribute(name);
    if (v !== null) {
      attrs[name] = v;
    }
  }
  return attrs;
}

export function createDragMoveHandler(ctx: DragHandlerContext): CommandHandler {
  return (command: Command): void => {
    if (command.type !== 'DRAG_MOVE') return;
    const { delta, elementIds } = command.options;
    const all = ctx.getElements();
    for (const id of elementIds) {
      const el = all.find((e) => e.id === id);
      if (!el) continue;
      el.applyDelta(delta.x, delta.y);
    }
  };
}

export function createDragEndHandler(ctx: DragHandlerContext): CommandHandler {
  return (command: Command): void => {
    if (command.type !== 'DRAG_END') return;
    const { elementIds } = command.options;
    const all = ctx.getElements();

    const targets = elementIds
      .map((id) => all.find((e) => e.id === id))
      .filter((e): e is SvgElement => !!e);

    ctx.history.captureBefore({ type: 'DRAG_END' });
    for (const el of targets) {
      ctx.history.push({ id: el.id, properties: extractElementProperties(el) });
    }

    for (const el of targets) {
      el.flushTransformToCoords();
    }

    const after = targets.map((el) => ({
      id: el.id,
      properties: extractElementProperties(el),
    }));
    ctx.history.captureAfter(after);

    ctx.onDragEnd?.(elementIds);
  };
}
