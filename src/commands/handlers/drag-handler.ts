import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export interface DragHandlerContext {
  getElements: () => AbstractGraphicElement[];
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
    for (const id of elementIds) {
      const el = all.find((e) => e.id === id);
      if (!el) continue;
      el.buildHitArea();
      el.setDirty();
    }
    ctx.onDragEnd?.(elementIds);
  };
}
