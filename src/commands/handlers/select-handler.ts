import type { Command } from '../types';
import type { CommandHandler } from '../registry';
import type { SelectionState } from '@/selection/SelectionState';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SpatialGrid } from '@/spatial/SpatialGrid';
import { hitTestByPoint as hitTestPoint, hitTestByRect as hitTestRect, hitTestByLasso as hitTestLasso } from '@/spatial/hit-test';
import {
  hitTestGroupsByPoint as hitTestGroupsPoint,
  hitTestGroupsByRect as hitTestGroupsRect,
  hitTestGroupsByLasso as hitTestGroupsLasso,
} from '@/spatial/group-hit-test';

export interface SelectHandlerContext {
  state: SelectionState;
  getElements: () => AbstractGraphicElement[];
  grid: SpatialGrid;
  lookupGroup: (elementId: string) => string | undefined;
}

const handleElementSelect = (
  gesture: string,
  options: Record<string, unknown>,
  toggle: boolean,
  all: AbstractGraphicElement[],
  ctx: SelectHandlerContext,
): void => {
  switch (gesture) {
    case 'click': {
      const pt = options.point as { x: number; y: number };
      if (!pt) return;
      const hits = hitTestPoint(pt.x, pt.y, all, ctx.grid);
      if (hits.length === 0) {
        if (!toggle) ctx.state.clear();
        return;
      }
      const picked = hits[hits.length - 1];
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
      const hits = hitTestRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        all,
        ctx.grid,
        boxDirection === 'left-to-right',
      );
      if (toggle) {
        for (const h of hits) ctx.state.toggle([h]);
      } else {
        ctx.state.replace(hits);
      }
      break;
    }
    case 'lasso': {
      const pts = options.lassoPoints as { x: number; y: number }[];
      if (!pts || pts.length < 3) return;
      const hits = hitTestLasso(pts, all, ctx.grid);
      if (toggle) {
        for (const h of hits) ctx.state.toggle([h]);
      } else {
        ctx.state.replace(hits);
      }
      break;
    }
  }
};

const handleGroupSelect = (
  gesture: string,
  options: Record<string, unknown>,
  _toggle: boolean,
  all: AbstractGraphicElement[],
  ctx: SelectHandlerContext,
): void => {
  switch (gesture) {
    case 'click': {
      const pt = options.point as { x: number; y: number };
      if (!pt) return;
      const gids = hitTestGroupsPoint(
        pt.x,
        pt.y,
        all,
        ctx.grid,
        ctx.lookupGroup,
      );
      if (gids.length > 0) {
        ctx.state.replace(
          all.filter((e) => gids.includes(ctx.lookupGroup(e.id) ?? '')),
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
      const gids = hitTestGroupsRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        all,
        ctx.grid,
        ctx.lookupGroup,
        boxDirection === 'left-to-right',
      );
      const targets = all.filter((e) =>
        gids.includes(ctx.lookupGroup(e.id) ?? ''),
      );
      ctx.state.replace(targets);
      break;
    }
    case 'lasso': {
      const pts = options.lassoPoints as { x: number; y: number }[];
      if (!pts || pts.length < 3) return;
      const gids = hitTestGroupsLasso(pts, all, ctx.grid, ctx.lookupGroup);
      const targets = all.filter((e) =>
        gids.includes(ctx.lookupGroup(e.id) ?? ''),
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
