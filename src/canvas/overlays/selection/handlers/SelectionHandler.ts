import { DEFAULT_SELECTION_SHORTCUTS } from '@/canvas/overlays/selection/selection-defaults';
import type { SelectionShortcuts, SelectionGesture } from '@/types';
import { DragHandler } from '@/canvas/overlays/selection/drag';
import { GroupSelectionHandler } from '@/canvas/overlays/selection/handlers/GroupSelectionHandler';
import { PathNodeHandler } from '@/canvas/overlays/selection/handlers/PathNodeHandler';
import { PathTimeMachine as PathTimeMachineClass } from '@/shapes/path/PathTimeMachine';
import { hitTestByPoint as hitTestPoint } from '@/math/hit-test';
import { pointToSegmentDist } from '@/math/geometry-utils';
import { createSelectPickCommand } from '@/commands/factories/select-command-factory';
import { AreaSelectionManager } from '@/canvas/overlays/selection/AreaSelectionManager';
import type { ImageElement } from '@/shapes/elements/ImageElement';
import { computeGroupWorldBBox } from '@/math/group-bbox-utils';
import type { SelectionHandlerOptions } from '@/types';
import type { PathTimeMachine } from '@/shapes/path/PathTimeMachine';

export class SelectionHandler {
  private readonly opts: SelectionHandlerOptions;
  private readonly dragHandler: DragHandler;
  private readonly groupHandler: GroupSelectionHandler;
  private readonly pathNodeHandler: PathNodeHandler;
  private readonly areaSelectionManager: AreaSelectionManager;
  private pathTimeMachine: PathTimeMachine | null = null;

  private shortcuts: SelectionShortcuts;
  private gesture: SelectionGesture = 'click';
  private ctrlHeld = false;
  private shiftOverride = false;

  private panning = false;
  private panStart = { x: 0, y: 0 };
  private panAuto = false;
  private panStartWorld: { x: number; y: number } | null = null;

  public constructor(opts: SelectionHandlerOptions) {
    this.opts = opts;
    this.shortcuts = { ...DEFAULT_SELECTION_SHORTCUTS, ...opts.shortcuts };
    this.dragHandler = new DragHandler(
      opts.bus,
      opts.camera,
      opts.grid,
      opts.getElements,
      opts.getArtboardRect ?? (() => null),
      opts.getGuidelines ?? (() => []),
      opts.getGridLines ?? (() => []),
    );

    const groupLookup = opts.getGroupIdForElement ?? (() => undefined);
    this.pathNodeHandler = new PathNodeHandler();
    this.pathNodeHandler.onNodeActivate = (cmdIdx) => {
      opts.pathNodeOverlay.activeCmdIdx = cmdIdx;
      const editingPath = opts.getEditingPath?.();
      if (editingPath) {
        opts.pathNodeOverlay.updatePathNodes(editingPath);
      }
    };
    this.groupHandler = new GroupSelectionHandler({
      getElements: opts.getElements,
      grid: opts.grid,
      lookupGroup: groupLookup,
      camera: opts.camera,
      bus: opts.bus,
      dragHandler: this.dragHandler,
      onGroupSelect: (ids) => opts.onGroupSelect?.(ids),
    });

    this.dragHandler.onDragStart = () => {
      opts.svg.style.cursor = 'grabbing';
      opts.onDragStart?.();
    };
    this.dragHandler.onDragMove = (dx: number, dy: number) =>
      opts.onDragMove?.(dx, dy);
    this.dragHandler.onDragEnd = () => {
      opts.svg.style.cursor = '';
      opts.onDragEnd?.();
    };

    const origOnGroupSelect = opts.onGroupSelect;
    opts.onGroupSelect = (ids) => {
      this.groupHandler.setCurrentGroupIds(ids);
      origOnGroupSelect?.(ids);
    };

    const origOnSetEditingPath = opts.onSetEditingPath;
    opts.onSetEditingPath = (path) => {
      if (path) {
        if (path.type === 'path') {
          this.pathTimeMachine = new PathTimeMachineClass(path as any);
          this.pathNodeHandler.pathTimeMachine = this.pathTimeMachine;
          this.opts.timeMachine!.suppressTimeMachine = true;
        }
      } else {
        this.flushPathTimeMachine();
      }
      origOnSetEditingPath?.(path);
    };

    this.areaSelectionManager = new AreaSelectionManager(
      opts.state,
      opts.bus,
      opts.getElements,
      opts.registerDirty,
      opts.getGroupIdForElement ?? (() => undefined),
      opts.onGroupSelect,
    );

    this.bindEvents();
  }

  public onMouseDown(e: MouseEvent): boolean {
    if (e.button !== 0) return false;

    if (this.opts.isCreating?.()) return false;

    if (this.opts.isGuidelineDragging?.()) return false;

    const rootSvg = this.opts.svg;

    if (this.opts.isPanning?.()) {
      this.panning = true;
      const svgPt = this.clientToSvg(e);
      this.panStart = { x: svgPt.x, y: svgPt.y };
      rootSvg.style.cursor = 'grabbing';
      e.preventDefault();
      return true;
    }

    const svgPt = this.clientToSvg(e);
    const worldPt = this.screenToWorld(e);

    this.ctrlHeld = e.ctrlKey || e.metaKey;
    this.shiftOverride = e.shiftKey;
    const useRect = this.gesture === 'rect' || this.shiftOverride;
    const isGroup = () => this.opts.state.mode === 'group';

    // Path node editing — check handle hit
    const editingPath = this.opts.getEditingPath?.();
    if (editingPath) {
      const handleHit = this.opts.pathNodeOverlay.hitTestPathNode(
        svgPt.x,
        svgPt.y,
      );
      if (handleHit) {
        const started = this.pathNodeHandler.startFromHandle(
          handleHit.elementId,
          handleHit.cmdIdx,
          handleHit.ptIdx,
          this.opts.getElements(),
          worldPt,
        );
        if (started) {
          e.preventDefault();
          return true;
        }
      }

      const all = this.opts.getElements();
      const hits = hitTestPoint(worldPt.x, worldPt.y, all, this.opts.grid);
      const hitEditing = hits.some((h) => h.id === editingPath.id);
      if (!hitEditing) {
        this.opts.onSetEditingPath?.(null);
      } else {
        e.preventDefault();
        return true;
      }
    }

    // Handle hit test
    if (this.tryHandleHitTest(svgPt)) {
      e.preventDefault();
      return true;
    }

    if (isGroup()) {
      if (this.tryGroupHandleHitTest(svgPt)) {
        e.preventDefault();
        return true;
      }

      const started = this.groupHandler.onMouseDown(
        worldPt,
        this.ctrlHeld,
        this.shiftOverride,
      );
      if (started) {
        e.preventDefault();
        return true;
      } else if (this.areaSelectionManager.onMouseDown(svgPt, worldPt, this.ctrlHeld, this.shiftOverride, 'group', false)) {
        e.preventDefault();
        return true;
      }
      return true;
    }

    // Element hit test → drag
    if (!this.ctrlHeld) {
      if (this.tryElementHitTestAndDrag(worldPt)) {
        e.preventDefault();
        return true;
      }
    }

    // Auto-pan on empty canvas
    if (!useRect && this.gesture !== 'lasso' && !this.ctrlHeld) {
      this.panAuto = true;
      this.panning = true;
      this.panStart = { x: svgPt.x, y: svgPt.y };
      this.panStartWorld = { x: worldPt.x, y: worldPt.y };
      rootSvg.style.cursor = 'grabbing';
      e.preventDefault();
      return true;
    }

    if (this.areaSelectionManager.onMouseDown(svgPt, worldPt, this.ctrlHeld, this.shiftOverride, 'element', false)) {
      if (!this.ctrlHeld) this.opts.state.clear();
      return true;
    }

    const cmd = createSelectPickCommand('element', worldPt, this.ctrlHeld);
    this.opts.bus.execute(cmd);
    return true;
  }

  public onMouseMove(e: MouseEvent): boolean {
    if (e.buttons === 0) return false;

    if (this.panning) {
      const svgPt = this.clientToSvg(e);
      const dx = svgPt.x - this.panStart.x;
      const dy = svgPt.y - this.panStart.y;
      this.opts.camera.pan(dx, dy);
      this.panStart = { x: svgPt.x, y: svgPt.y };
      return true;
    }

    const svgPt = this.clientToSvg(e);
    const worldPt = this.screenToWorld(e);
    const isGroup = () => this.opts.state.mode === 'group';

    if (this.pathNodeHandler.isActive) {
      this.pathNodeHandler.move(worldPt);
      return true;
    }

    if (this.opts.transformHandler.isActive) {
      this.opts.transformHandler.move(worldPt, e.shiftKey);
      return true;
    }

    const areaHandled = this.areaSelectionManager.onMouseMove(svgPt, worldPt, isGroup() ? 'group' : 'element');
    void areaHandled;

    if (isGroup()) {
      if (this.opts.groupTransformHandler.isActive) {
        this.opts.groupTransformHandler.move(worldPt, e.shiftKey);
        return true;
      }
      if (this.dragHandler.isActive) this.dragHandler.move(worldPt);
      return true;
    }

    if (this.dragHandler.isActive) {
      this.dragHandler.move(worldPt);
      return true;
    }
    return true;
  }

  public onMouseUp(e: MouseEvent): boolean {
    if (e.button !== 0) return false;

    const rootSvg = this.opts.svg;
    const isGroup = () => this.opts.state.mode === 'group';

    if (this.panning) {
      this.panning = false;
      rootSvg.style.cursor = '';
      if (this.panAuto) {
        this.panAuto = false;
        const worldPt = this.screenToWorld(e);
        const dx = worldPt.x - (this.panStartWorld?.x ?? 0);
        const dy = worldPt.y - (this.panStartWorld?.y ?? 0);
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          const cmd = createSelectPickCommand(
            'element',
            worldPt,
            this.ctrlHeld,
          );
          this.opts.bus.execute(cmd);
        }
        this.panStartWorld = null;
      }
      return true;
    }

    const worldPt = this.screenToWorld(e);

    if (this.pathNodeHandler.isActive) {
      this.pathNodeHandler.end();
      return true;
    }

    if (this.opts.transformHandler.isActive) {
      this.opts.transformHandler.end();
      return true;
    }

    if (isGroup()) {
      if (this.opts.groupTransformHandler.isActive) {
        this.opts.groupTransformHandler.end();
        return true;
      }
      if (this.dragHandler.isActive) this.dragHandler.end();
      else if (this.areaSelectionManager.onMouseUp(worldPt, this.ctrlHeld, 'group')) {
        return true;
      }
      return true;
    }

    if (this.dragHandler.isActive) {
      this.dragHandler.end();
      return true;
    }

    if (this.areaSelectionManager.onMouseUp(worldPt, this.ctrlHeld, 'element')) {
      return true;
    }
    return false;
  }

  public onWheel(e: WheelEvent): boolean {
    e.preventDefault();
    const svgPt = this.clientToSvg(e);
    if (!svgPt.x && !svgPt.y) return false;
    this.opts.camera.setZoom(svgPt, e.deltaY > 0 ? 0.95 : 1.05);
    return true;
  }

  public onDblClick(e: MouseEvent): boolean {
    if (e.button !== 0) return false;
    if (e.defaultPrevented) return false;
    const worldPt = this.screenToWorld(e);

    const editingPath = this.opts.getEditingPath?.();
    if (editingPath && editingPath.type === 'path') {
      const svgPt = this.clientToSvg(e);
      const handleHit = this.opts.pathNodeOverlay.hitTestPathNode(
        svgPt.x,
        svgPt.y,
      );
      if (handleHit) return false;

      const pathEl =
        editingPath as any as import('@/shapes/elements/PathElement').PathElement;
      const cmds = pathEl.geometry.commands;

      const inv = pathEl.transform.matrix.inverse();
      const localPt = inv.transformPoint({ x: worldPt.x, y: worldPt.y });

      let closestDist = Infinity;
      let closestCmdIdx = -1;
      let closestT = 0;
      let closestPrevEndX = 0;
      let closestPrevEndY = 0;

      for (let i = 1; i < cmds.length; i++) {
        const cmd = cmds[i];
        const cc = cmd.command.toUpperCase();
        if (cc === 'M') continue;

        const prev = cmds[i - 1];
        let ax: number, ay: number;
        if (
          prev.command.toUpperCase() === 'M' ||
          prev.command.toUpperCase() === 'L' ||
          prev.command.toUpperCase() === 'T'
        ) {
          ax = prev.args[0];
          ay = prev.args[1];
        } else if (
          prev.command.toUpperCase() === 'C' &&
          prev.args.length >= 6
        ) {
          ax = prev.args[4];
          ay = prev.args[5];
        } else if (
          prev.command.toUpperCase() === 'S' &&
          prev.args.length >= 4
        ) {
          ax = prev.args[2];
          ay = prev.args[3];
        } else if (
          prev.command.toUpperCase() === 'Q' &&
          prev.args.length >= 4
        ) {
          ax = prev.args[2];
          ay = prev.args[3];
        } else continue;

        if (cc === 'L' || cc === 'T') {
          const bx = cmd.args[0],
            by = cmd.args[1];
          const {
            dist,
            closestX: cx,
            closestY: cy,
          } = pointToSegmentDist(localPt.x, localPt.y, ax, ay, bx, by);
          if (dist < closestDist) {
            closestDist = dist;
            closestCmdIdx = i - 1;
            closestPrevEndX = ax;
            closestPrevEndY = ay;
            const dx = bx - ax,
              dy = by - ay;
            const lenSq = dx * dx + dy * dy;
            closestT =
              lenSq > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / lenSq : 0;
          }
        } else if (cc === 'C' && cmd.args.length >= 6) {
          const [c1x, c1y, c2x, c2y, ex, ey] = cmd.args;
          let bestT = 0;
          let bestDistC = Infinity;
          for (let s = 0; s <= 20; s++) {
            const t = s / 20;
            const mt = 1 - t;
            const px =
              mt * mt * mt * ax +
              3 * mt * mt * t * c1x +
              3 * mt * t * t * c2x +
              t * t * t * ex;
            const py =
              mt * mt * mt * ay +
              3 * mt * mt * t * c1y +
              3 * mt * t * t * c2y +
              t * t * t * ey;
            const d = Math.hypot(localPt.x - px, localPt.y - py);
            if (d < bestDistC) {
              bestDistC = d;
              bestT = t;
            }
          }
          if (bestDistC < closestDist) {
            closestDist = bestDistC;
            closestCmdIdx = i - 1;
            closestT = bestT;
            closestPrevEndX = ax;
            closestPrevEndY = ay;
          }
        } else if (cc === 'Q' && cmd.args.length >= 4) {
          const [c1x, c1y, ex, ey] = cmd.args;
          let bestT = 0;
          let bestDistQ = Infinity;
          for (let s = 0; s <= 20; s++) {
            const t = s / 20;
            const mt = 1 - t;
            const px = mt * mt * ax + 2 * mt * t * c1x + t * t * ex;
            const py = mt * mt * ay + 2 * mt * t * c1y + t * t * ey;
            const d = Math.hypot(localPt.x - px, localPt.y - py);
            if (d < bestDistQ) {
              bestDistQ = d;
              bestT = t;
            }
          }
          if (bestDistQ < closestDist) {
            closestDist = bestDistQ;
            closestCmdIdx = i - 1;
            closestT = bestT;
            closestPrevEndX = ax;
            closestPrevEndY = ay;
          }
        } else if (cc === 'S' && cmd.args.length >= 4) {
          const prevCmd = cmds[i - 1];
          const pc = prevCmd?.command.toUpperCase();
          let reflectX = ax,
            reflectY = ay;
          if (pc === 'C' && prevCmd.args.length >= 6) {
            reflectX = 2 * ax - prevCmd.args[2];
            reflectY = 2 * ay - prevCmd.args[3];
          }
          const [c2x, c2y, ex, ey] = cmd.args;
          let bestT = 0;
          let bestDistS = Infinity;
          for (let s = 0; s <= 20; s++) {
            const t = s / 20;
            const mt = 1 - t;
            const px =
              mt * mt * mt * ax +
              3 * mt * mt * t * reflectX +
              3 * mt * t * t * c2x +
              t * t * t * ex;
            const py =
              mt * mt * mt * ay +
              3 * mt * mt * t * reflectY +
              3 * mt * t * t * c2y +
              t * t * t * ey;
            const d = Math.hypot(localPt.x - px, localPt.y - py);
            if (d < bestDistS) {
              bestDistS = d;
              bestT = t;
            }
          }
          if (bestDistS < closestDist) {
            closestDist = bestDistS;
            closestCmdIdx = i - 1;
            closestT = bestT;
            closestPrevEndX = ax;
            closestPrevEndY = ay;
          }
        }
      }

      if (closestCmdIdx >= 0 && closestDist < 40) {
        const nextCmd = cmds[closestCmdIdx + 1];
        const ncc = nextCmd.command.toUpperCase();
        let localX = localPt.x,
          localY = localPt.y;

        if (
          (ncc === 'C' || ncc === 'S' || ncc === 'Q') &&
          closestT >= 0 &&
          closestT <= 1
        ) {
          const Ax = closestPrevEndX,
            Ay = closestPrevEndY;
          if (ncc === 'C' && nextCmd.args.length >= 6) {
            const [c1x, c1y, c2x, c2y, ex, ey] = nextCmd.args;
            const t = closestT,
              mt = 1 - t;
            localX =
              mt * mt * mt * Ax +
              3 * mt * mt * t * c1x +
              3 * mt * t * t * c2x +
              t * t * t * ex;
            localY =
              mt * mt * mt * Ay +
              3 * mt * mt * t * c1y +
              3 * mt * t * t * c2y +
              t * t * t * ey;
          } else if (ncc === 'Q' && nextCmd.args.length >= 4) {
            const [c1x, c1y, ex, ey] = nextCmd.args;
            const t = closestT,
              mt = 1 - t;
            localX = mt * mt * Ax + 2 * mt * t * c1x + t * t * ex;
            localY = mt * mt * Ay + 2 * mt * t * c1y + t * t * ey;
          } else if (ncc === 'S' && nextCmd.args.length >= 4) {
            const [c2x, c2y, ex, ey] = nextCmd.args;
            const t = closestT,
              mt = 1 - t;
            localX =
              mt * mt * mt * Ax +
              3 *
                mt *
                mt *
                t *
                (2 * Ax - (cmds[closestCmdIdx]?.args?.[2] ?? Ax)) +
              3 * mt * t * t * c2x +
              t * t * t * ex;
            localY =
              mt * mt * mt * Ay +
              3 *
                mt *
                mt *
                t *
                (2 * Ay - (cmds[closestCmdIdx]?.args?.[3] ?? Ay)) +
              3 * mt * t * t * c2y +
              t * t * t * ey;
          }
        }

        this.opts.bus.execute({
          type: 'PATH_ADD_NODE',
          options: {
            id: editingPath.id,
            cmdIdx: closestCmdIdx,
            x: localX,
            y: localY,
            t: closestT,
            prevEndX: closestPrevEndX,
            prevEndY: closestPrevEndY,
          },
        });
        this.pathTimeMachine?.capture();
        e.preventDefault();
        return true;
      }
    }

    const all = this.opts.getElements();
    const hits = hitTestPoint(worldPt.x, worldPt.y, all, this.opts.grid);
    if (hits.length > 0) {
      const picked = hits[hits.length - 1];
      if (
        picked.type === 'path' ||
        picked.type === 'polyline' ||
        picked.type === 'polygon'
      ) {
        this.opts.onSetEditingPath?.(picked);
      } else if (picked.type === 'image') {
        const dto = (picked as ImageElement).toDTO();
        this.opts.events.emit('IMG_SELECT_EDIT', dto);
      }
    }
    return true;
  }

  public onKeyDown(e: KeyboardEvent): boolean {
    const key = e.key.toLowerCase();
    if (key === this.shortcuts.selectElement) this.gesture = 'click';
    else if (key === this.shortcuts.selectGroup) {
      this.gesture = 'click';
      this.opts.state.setMode('group');
    } else if (key === 'r') this.gesture = 'rect';
    else if (key === 'l') this.gesture = 'lasso';
    else if (key === 'v') {
      this.gesture = 'click';
      this.opts.state.setMode('element');
    } else if (e.key === 'Enter') {
      const selected = this.opts.state.selected;
      if (selected.length === 1 && selected[0].type === 'path') {
        this.opts.onSetEditingPath?.(selected[0]);
        e.preventDefault();
        return true;
      }
    } else if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      this.pathNodeHandler.isActive
    ) {
      const editingPath = this.opts.getEditingPath?.();
      if (editingPath) {
        const act = this.pathNodeHandler.activation;
        if (act) {
          this.opts.bus.execute({
            type: 'PATH_REMOVE_NODE',
            options: { id: editingPath.id, cmdIdx: act.cmdIdx },
          });
          this.pathNodeHandler.abort();
          this.pathTimeMachine?.capture();
          e.preventDefault();
          return true;
        }
      }
    } else if (this.pathNodeHandler.isActive && key === 'c') {
      const editingPath = this.opts.getEditingPath?.();
      const act = this.pathNodeHandler.activation;
      if (editingPath && act) {
        this.opts.bus.execute({
          type: 'PATH_CHANGE_NODE_TYPE',
          options: { id: editingPath.id, cmdIdx: act.cmdIdx, newType: 'C' },
        });
        this.pathTimeMachine?.capture();
        e.preventDefault();
        return true;
      }
    } else if (this.pathNodeHandler.isActive && key === 'l') {
      const editingPath = this.opts.getEditingPath?.();
      const act = this.pathNodeHandler.activation;
      if (editingPath && act) {
        this.opts.bus.execute({
          type: 'PATH_CHANGE_NODE_TYPE',
          options: { id: editingPath.id, cmdIdx: act.cmdIdx, newType: 'L' },
        });
        this.pathTimeMachine?.capture();
        e.preventDefault();
        return true;
      }
    } else if (key === 'escape') {
      if (this.pathTimeMachine) {
        const editingPath = this.opts.getEditingPath?.();
        if (editingPath) this.opts.onSetEditingPath?.(null);
      } else {
        this.opts.state.clear();
        this.opts.onGroupSelect?.([]);
      }
      return true;
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      if (this.pathTimeMachine) {
        e.preventDefault();
        this.pathTimeMachine.undo();
        const editingPath = this.opts.getEditingPath?.();
        if (editingPath)
          this.opts.pathNodeOverlay.updatePathNodes(editingPath);
        return true;
      } else if (this.opts.getEditingPath?.()) {
        e.preventDefault();
        return true;
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      if (this.pathTimeMachine) {
        e.preventDefault();
        this.pathTimeMachine.redo();
        const editingPath = this.opts.getEditingPath?.();
        if (editingPath)
          this.opts.pathNodeOverlay.updatePathNodes(editingPath);
        return true;
      } else if (this.opts.getEditingPath?.()) {
        e.preventDefault();
        return true;
      }
    }
    return false;
  }

  private bindEvents(): void {
    // Event delegation now handled by EventManager.
    // All logic moved to onMouseDown/Move/Up/DblClick/KeyDown methods.
  }

  private flushPathTimeMachine(): void {
    if (!this.pathTimeMachine) return;
    const editingPath = this.opts.getEditingPath?.();
    if (editingPath && editingPath.type === 'path') {
      const pathEl =
        editingPath as any as import('@/shapes/elements/PathElement').PathElement;
      const postCommands = pathEl.geometry.commands.map((c: any) => ({
        ...c,
        args: [...c.args],
      }));

      const initialSnapshot = this.pathTimeMachine!.getRootCommands();
      if (initialSnapshot) {
        pathEl.geometry.commands = initialSnapshot.map((c: any) => ({
          ...c,
          args: [...c.args],
        }));
        pathEl.rebuildHitArea();
      }

      this.opts.timeMachine!.suppressTimeMachine = false;
      this.opts.bus.execute({
        type: 'GEOMETRY_MUTATE',
        options: { id: editingPath.id, newCommands: postCommands },
      });
    }
    this.pathTimeMachine.clear();
    this.pathTimeMachine = null;
    this.pathNodeHandler.pathTimeMachine = null;
    this.opts.timeMachine!.suppressTimeMachine = false;
  }

  private clientToSvg(e: MouseEvent): { x: number; y: number } {
    const svg = this.opts.svg;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return point.matrixTransform(ctm.inverse());
  }

  private screenToWorld(e: MouseEvent): { x: number; y: number } {
    const svgPt = this.clientToSvg(e);
    return this.opts.camera.screenToWorld({ x: svgPt.x, y: svgPt.y });
  }

  private tryElementHitTestAndDrag(wp: { x: number; y: number }): boolean {
    const all = this.opts.getElements();
    const hits = hitTestPoint(wp.x, wp.y, all, this.opts.grid);
    if (hits.length === 0) return false;

    const picked = hits[hits.length - 1];
    const selectedIds = new Set(this.opts.state.selected.map((s) => s.id));

    if (!selectedIds.has(picked.id)) {
      const cmd = createSelectPickCommand('element', wp, false);
      this.opts.bus.execute(cmd);
      selectedIds.clear();
      selectedIds.add(picked.id);
    }

    const selected = all.filter((e) => selectedIds.has(e.id));
    if (selected.length > 0) {
      this.dragHandler.startWithoutCheck(wp, selected);
      return true;
    }

    return false;
  }

  private tryHandleHitTest(svgPt: { x: number; y: number }): boolean {
    const worldPt = this.opts.camera.screenToWorld(svgPt);
    const hit = this.opts.selectionManager.hitTestHandle(worldPt.x, worldPt.y);
    if (!hit) return false;

    const { handle, targetId } = hit;
    const element = this.opts.getElements().find((e) => e.id === targetId);
    if (!element) return false;

    return this.opts.transformHandler.tryStart(
      handle,
      new DOMRect(0, 0, 0, 0),
      element,
      worldPt,
      this.opts.state.selected,
    );
  }

  private tryGroupHandleHitTest(svgPt: { x: number; y: number }): boolean {
    const worldPt = this.opts.camera.screenToWorld(svgPt);
    const hit = this.opts.selectionManager.hitTestHandle(worldPt.x, worldPt.y);
    if (!hit) return false;

    const groups = this.opts.getSelectedGroups?.() ?? [];
    const findElement = (id: string) =>
      this.opts.getElements().find((e) => e.id === id);

    let groupBBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null;
    for (const g of groups) {
      if (g.id === hit.targetId) {
        groupBBox = computeGroupWorldBBox(g, findElement);
        break;
      }
    }
    if (!groupBBox) return false;

    return this.opts.groupTransformHandler.tryStart(
      hit.handle,
      groupBBox,
      worldPt,
      groups,
      findElement,
    );
  }

}
