import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { SpatialGrid } from '@/selection/SpatialGrid';
import type { Camera } from '@/camera/Camera';
import type { DragHandler } from '@/selection/DragHandler';
import {
  hitTestGroupsPoint,
  hitTestGroupsRect,
  hitTestGroupsLasso,
} from '@/utils/group-hit-test';
import type { CommandBus } from '@/commands/CommandBus';
import {
  createSelectPickCommand,
  createSelectRectCommand,
  createSelectLassoCommand,
} from '@/commands/factories/select-command-factory';

export interface GroupSelectionHandlerOptions {
  getElements: () => AbstractGraphicElement[];
  grid: SpatialGrid;
  lookupGroup: (elementId: string) => string | undefined;
  camera: Camera;
  bus: CommandBus;
  dragHandler: DragHandler;
  onGroupSelect?: (ids: string[]) => void;
}

export class GroupSelectionHandler {
  private readonly opts: GroupSelectionHandlerOptions;
  private readonly dragHandler: DragHandler;
  private currentGroupIds: string[] = [];

  public constructor(opts: GroupSelectionHandlerOptions) {
    this.opts = opts;
    this.dragHandler = opts.dragHandler;
  }

  public setCurrentGroupIds(ids: string[]): void {
    this.currentGroupIds = ids;
  }

  public onMouseDown(
    wp: { x: number; y: number },
    ctrl: boolean,
    _shift: boolean,
  ): boolean {
    const all = this.opts.getElements();
    const gids = hitTestGroupsPoint(
      wp.x,
      wp.y,
      all,
      this.opts.grid,
      this.opts.lookupGroup,
    );

    if (gids.length > 0) {
      const pickedGid = gids[gids.length - 1];
      const alreadySelected = !ctrl && this.currentGroupIds.includes(pickedGid);
      let targetGroupIds: string[];

      if (alreadySelected) {
        targetGroupIds = this.currentGroupIds;
      } else {
        const cmd = createSelectPickCommand('group', wp, ctrl);
        this.opts.bus.execute(cmd);
        this.opts.onGroupSelect?.(gids);
        targetGroupIds = gids;
      }

      const ids = this.collectGroupElementIds(targetGroupIds, all);
      if (ids.length > 0) {
        this.dragHandler.startWithoutCheck(wp, ids);
        return true;
      }
    } else if (!ctrl) {
      this.opts.onGroupSelect?.([]);
    }

    return false;
  }

  public onMouseUp(_wp: { x: number; y: number }, _ctrl: boolean): void {
    if (this.dragHandler.isActive) {
      this.dragHandler.end();
    }
  }

  public onRectEnd(
    wp: { x: number; y: number },
    ctrl: boolean,
    rectStart: { x: number; y: number },
  ): void {
    const all = this.opts.getElements();
    const dx = Math.abs(wp.x - rectStart.x);
    const dy = Math.abs(wp.y - rectStart.y);
    const wasDrag = dx >= 3 || dy >= 3;

    if (wasDrag) {
      const gids = hitTestGroupsRect(
        Math.min(wp.x, rectStart.x),
        Math.min(wp.y, rectStart.y),
        Math.abs(wp.x - rectStart.x),
        Math.abs(wp.y - rectStart.y),
        all,
        this.opts.grid,
        this.opts.lookupGroup,
        wp.x >= rectStart.x,
      );
      const boxDirection =
        wp.x >= rectStart.x ? 'left-to-right' : 'right-to-left';
      const cmd = createSelectRectCommand(
        'group',
        {
          x: Math.min(wp.x, rectStart.x),
          y: Math.min(wp.y, rectStart.y),
          width: Math.abs(wp.x - rectStart.x),
          height: Math.abs(wp.y - rectStart.y),
        },
        ctrl,
        boxDirection,
      );
      this.opts.bus.execute(cmd);
      this.opts.onGroupSelect?.(gids);
    }
  }

  public onLassoEnd(points: { x: number; y: number }[], ctrl: boolean): void {
    if (points.length >= 3) {
      const gids = hitTestGroupsLasso(
        points,
        this.opts.getElements(),
        this.opts.grid,
        this.opts.lookupGroup,
      );
      const cmd = createSelectLassoCommand('group', points, ctrl);
      this.opts.bus.execute(cmd);
      this.opts.onGroupSelect?.(gids);
    }
  }

  private collectGroupElementIds(
    groupIds: string[],
    all: AbstractGraphicElement[],
  ): AbstractGraphicElement[] {
    const elementIds = new Set<string>();
    for (const gid of groupIds) {
      const ids = all
        .filter((e) => this.opts.lookupGroup(e.id) === gid)
        .map((e) => e.id);
      for (const id of ids) elementIds.add(id);
    }
    return all.filter((e) => elementIds.has(e.id));
  }
}
