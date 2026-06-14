import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { SvgElement } from '@/shapes/elements/SvgElement';

export interface DragHandlerContext {
  getElements: () => SvgElement[];
  onDragEnd?: (elementIds: string[]) => void;
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
    for (const el of targets) {
      el.flushTransformToCoords();
    }
    ctx.onDragEnd?.(elementIds);
  };
}
