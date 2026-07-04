import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { DragHandler } from '@/canvas/overlays/selection/drag';
import { createSelectPickCommand } from '@/commands/factories/select-command-factory';
import type { GroupSelectionHandlerOptions } from '@/types';

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
    const gids = this.opts.hitTestEngine.queryPointGroups(
      wp.x,
      wp.y,
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
        this.dragHandler.setMode('group');
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
