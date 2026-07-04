import type { SelectionState } from '@/canvas/overlays/selection/SelectionState';
import type { CommandBus } from '@/commands/CommandBus';
import { RectOverlay } from './RectOverlay';
import { LassoOverlay } from './LassoOverlay';
import type { HitTestEngine } from '@/core/HitTestEngine';
import {
  createSelectPickCommand,
  createSelectRectCommand,
  createSelectLassoCommand,
} from '@/commands/factories/select-command-factory';
import type { SelectionGesture, SelectionMode, IRenderableNode } from '@/types';

export class AreaSelectionManager {
  private gesture: SelectionGesture = 'click';
  private readonly state: SelectionState;
  private readonly bus: CommandBus;
  private readonly lookupGroup: (elementId: string) => string | undefined;
  private readonly onGroupSelect?: (ids: string[]) => void;
  private readonly hitTestEngine: HitTestEngine;

  private rectActive = false;
  private rectStartWorld = { x: 0, y: 0 };
  private rectStartSvgX = 0;
  private readonly rectOverlay: RectOverlay;

  private lassoActive = false;
  private lassoWorldPoints: { x: number; y: number }[] = [];
  private readonly lassoOverlay: LassoOverlay;

  constructor(
    state: SelectionState,
    bus: CommandBus,
    _getElements: () => import('@/shapes/elements/AbstractGraphicElement').AbstractGraphicElement[],
    registerDirty: (node: IRenderableNode) => void,
    hitTestEngine: HitTestEngine,
    lookupGroup?: (elementId: string) => string | undefined,
    onGroupSelect?: (ids: string[]) => void,
  ) {
    this.state = state;
    this.bus = bus;
    this.hitTestEngine = hitTestEngine;
    this.lookupGroup = lookupGroup ?? (() => undefined);
    this.onGroupSelect = onGroupSelect;
    this.rectOverlay = new RectOverlay(registerDirty);
    this.lassoOverlay = new LassoOverlay(registerDirty);
  }

  public setGesture(g: SelectionGesture): void {
    this.gesture = g;
  }

  public getGesture(): SelectionGesture {
    return this.gesture;
  }

  public onMouseDown(
    svgPt: { x: number; y: number },
    worldPt: { x: number; y: number },
    ctrlHeld: boolean,
    shiftOverride: boolean,
    mode: SelectionMode,
    hasDragHit: boolean,
  ): boolean {
    const useRect = this.gesture === 'rect' || shiftOverride;

    if (mode === 'group') {
      if (hasDragHit) return false;
      if (useRect) {
        this.rectActive = true;
        this.rectStartWorld = { x: worldPt.x, y: worldPt.y };
        this.rectStartSvgX = svgPt.x;
        this.rectOverlay.show(svgPt.x, svgPt.y);
        if (!ctrlHeld) this.state.clear();
        return true;
      } else if (this.gesture === 'lasso') {
        this.lassoActive = true;
        this.lassoWorldPoints = [{ x: worldPt.x, y: worldPt.y }];
        this.lassoOverlay.show();
        this.lassoOverlay.addPoint(svgPt);
        if (!ctrlHeld) this.state.clear();
        return true;
      }
      return false;
    }

    if (hasDragHit) return false;

    if (useRect) {
      this.rectActive = true;
      this.rectStartWorld = { x: worldPt.x, y: worldPt.y };
      this.rectStartSvgX = svgPt.x;
      this.rectOverlay.show(svgPt.x, svgPt.y);
      if (!ctrlHeld) this.state.clear();
      return true;
    } else if (this.gesture === 'lasso') {
      this.lassoActive = true;
      this.lassoWorldPoints = [{ x: worldPt.x, y: worldPt.y }];
      this.lassoOverlay.show();
      this.lassoOverlay.addPoint(svgPt);
      if (!ctrlHeld) this.state.clear();
      return true;
    }

    return false;
  }

  public onMouseMove(
    svgPt: { x: number; y: number },
    worldPt: { x: number; y: number },
    mode: SelectionMode,
  ): void {
    if (mode === 'group') {
      if (this.rectActive) {
        this.rectOverlay.update(svgPt.x, svgPt.y, svgPt.x >= this.rectStartSvgX);
      }
      if (this.lassoActive) {
        this.lassoWorldPoints.push({ x: worldPt.x, y: worldPt.y });
        this.lassoOverlay.addPoint(svgPt);
      }
      return;
    }

    if (this.rectActive) {
      this.rectOverlay.update(svgPt.x, svgPt.y, svgPt.x >= this.rectStartSvgX);
    }

    if (this.lassoActive) {
      this.lassoWorldPoints.push({ x: worldPt.x, y: worldPt.y });
      this.lassoOverlay.addPoint(svgPt);
    }
  }

  public onMouseUp(
    worldPt: { x: number; y: number },
    ctrlHeld: boolean,
    mode: SelectionMode,
  ): boolean {
    if (this.rectActive) {
      this.rectActive = false;
      this.rectOverlay.hide();
      if (this._isDragGesture(worldPt)) {
        this._dispatchSelectRect(worldPt, ctrlHeld, mode);
      } else {
        this.bus.execute(createSelectPickCommand(mode, worldPt, ctrlHeld));
      }
      return true;
    }

    if (this.lassoActive) {
      this.lassoActive = false;
      this.lassoOverlay.hide();
      if (this.lassoWorldPoints.length >= 3) {
        this._dispatchSelectLasso(ctrlHeld, mode);
      } else {
        this.bus.execute(createSelectPickCommand(mode, worldPt, ctrlHeld));
      }
      this.lassoWorldPoints = [];
      return true;
    }

    return false;
  }

  private _isDragGesture(wp: { x: number; y: number }): boolean {
    return (
      Math.abs(wp.x - this.rectStartWorld.x) >= 3 ||
      Math.abs(wp.y - this.rectStartWorld.y) >= 3
    );
  }

  private _dispatchSelectRect(
    wp: { x: number; y: number },
    ctrl: boolean,
    mode: SelectionMode,
  ): void {
    const rect = {
      x: Math.min(this.rectStartWorld.x, wp.x),
      y: Math.min(this.rectStartWorld.y, wp.y),
      width: Math.abs(wp.x - this.rectStartWorld.x),
      height: Math.abs(wp.y - this.rectStartWorld.y),
    };
    const boxDirection =
      wp.x >= this.rectStartWorld.x ? 'left-to-right' : 'right-to-left';

    if (mode === 'group') {
      const gids = this.hitTestEngine.queryRectGroups(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        this.lookupGroup,
        boxDirection === 'left-to-right',
      );
      this.bus.execute(
        createSelectRectCommand('group', rect, ctrl, boxDirection),
      );
      this.onGroupSelect?.(gids);
    } else {
      this.bus.execute(
        createSelectRectCommand('element', rect, ctrl, 'right-to-left'),
      );
    }
  }

  private _dispatchSelectLasso(ctrl: boolean, mode: SelectionMode): void {
    if (mode === 'group') {
      const gids = this.hitTestEngine.queryLassoGroups(
        this.lassoWorldPoints,
        this.lookupGroup,
      );
      this.bus.execute(
        createSelectLassoCommand('group', this.lassoWorldPoints, ctrl),
      );
      this.onGroupSelect?.(gids);
    } else {
      this.bus.execute(
        createSelectLassoCommand('element', this.lassoWorldPoints, ctrl),
      );
    }
  }
}
