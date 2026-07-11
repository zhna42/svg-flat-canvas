import type {
  Command,
  CommandHandler,
  SelectHandlerContext,
} from '@/core/type';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';

const handleElementSelect = (
  gesture: string,
  options: Record<string, unknown>,
  toggle: boolean,
  _all: AbstractGraphicElement[],
  ctx: SelectHandlerContext,
): void => {
  const engine = ctx.hitTestEngine;
  switch (gesture) {
    case 'click': {
      const pt = options.point as { x: number; y: number };
      if (!pt) return;
      const { hits } = engine.queryPoint(pt.x, pt.y);
      if (hits.length === 0) {
        if (!toggle) ctx.state.clear();
        return;
      }
      const picked = hits[hits.length - 1] as AbstractGraphicElement;
      if (toggle) {
        ctx.state.toggle([picked]);
      } else {
        ctx.state.replace([picked]);
      }
      break;
    }
    case 'rect': {
      const rect = options.rect as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      const boxDirection =
        (options.boxDirection as 'left-to-right' | 'right-to-left') ??
        'left-to-right';
      if (!rect) return;
      const { hits } = engine.queryRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        { requireFullContain: boxDirection === 'left-to-right' },
      );
      const typed = hits as AbstractGraphicElement[];
      if (toggle) {
        for (const h of typed) ctx.state.toggle([h]);
      } else {
        ctx.state.replace(typed);
      }
      break;
    }
    case 'lasso': {
      const pts = options.lassoPoints as { x: number; y: number }[];
      if (!pts || pts.length < 3) return;
      const { hits } = engine.queryLasso(pts);
      const typed = hits as AbstractGraphicElement[];
      if (toggle) {
        for (const h of typed) ctx.state.toggle([h]);
      } else {
        ctx.state.replace(typed);
      }
      break;
    }
  }
};

const handleGroupSelect = (
  gesture: string,
  options: Record<string, unknown>,
  _toggle: boolean,
  _all: AbstractGraphicElement[],
  ctx: SelectHandlerContext,
): void => {
  const engine = ctx.hitTestEngine;
  const lookupGroup = ctx.lookupGroup;
  switch (gesture) {
    case 'click': {
      const pt = options.point as { x: number; y: number };
      if (!pt) return;
      const gids = engine.queryPointGroups(pt.x, pt.y, lookupGroup);
      if (gids.length > 0) {
        ctx.state.replace(
          _all.filter((e) => gids.includes(lookupGroup(e.id) ?? '')),
        );
      } else if (!_toggle) {
        ctx.state.clear();
      }
      break;
    }
    case 'rect': {
      const rect = options.rect as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      const boxDirection =
        (options.boxDirection as 'left-to-right' | 'right-to-left') ??
        'left-to-right';
      if (!rect) return;
      const gids = engine.queryRectGroups(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        lookupGroup,
        boxDirection === 'left-to-right',
      );
      const targets = _all.filter((e) =>
        gids.includes(lookupGroup(e.id) ?? ''),
      );
      ctx.state.replace(targets);
      break;
    }
    case 'lasso': {
      const pts = options.lassoPoints as { x: number; y: number }[];
      if (!pts || pts.length < 3) return;
      const gids = engine.queryLassoGroups(pts, lookupGroup);
      const targets = _all.filter((e) =>
        gids.includes(lookupGroup(e.id) ?? ''),
      );
      ctx.state.replace(targets);
      break;
    }
  }
};

export const createSelectHandler = (
  ctx: SelectHandlerContext,
): CommandHandler => {
  return (command: Command): void => {
    if (command.type !== 'SELECT') return;
    const { options } = command;
    const { mode, gesture, toggle } = options;
    const all = ctx.getElements();

    if (mode === 'group') {
      handleGroupSelect(gesture, options, toggle, all, ctx);
    } else {
      handleElementSelect(gesture, options, toggle, all, ctx);
    }
  };
};
