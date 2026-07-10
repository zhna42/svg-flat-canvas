import { DEFAULT_SELECTION_SHORTCUTS } from '@/canvas/overlays/selection/selection-defaults';
import type {
  SelectionShortcuts,
  SelectionGesture,
  SnapAxisMode,
} from '@/types';
import { DragHandler } from '@/canvas/overlays/selection/drag';
import { GroupSelectionHandler } from '@/canvas/overlays/selection/handlers/GroupSelectionHandler';
import { createSelectPickCommand } from '@/commands/factories/select-command-factory';
import { AreaSelectionManager } from '@/canvas/overlays/selection/AreaSelectionManager';
import type { ImageElement } from '@/shapes/elements/ImageElement';
import { computeGroupOBB } from '@/math/group-bbox-utils';
import type { SelectionHandlerOptions } from '@/types';
import type { NodeEditCoordinator } from '@/canvas/overlays/nodeedit/NodeEditCoordinator';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';

export class SelectionHandler {
  private readonly opts: SelectionHandlerOptions;
  private readonly dragHandler: DragHandler;
  private readonly groupHandler: GroupSelectionHandler;
  private readonly nodeEdit: NodeEditCoordinator;
  private readonly areaSelectionManager: AreaSelectionManager;

  private shortcuts: SelectionShortcuts;
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
      opts.hitTestEngine,
      opts.getElements,
      opts.getArtboardRect ?? (() => null),
      opts.getGuidelines ?? (() => []),
      opts.getGridLines ?? (() => []),
    );

    const groupLookup = opts.getGroupIdForElement ?? (() => undefined);
    this.nodeEdit = opts.nodeEdit;
    this.groupHandler = new GroupSelectionHandler({
      getElements: opts.getElements,
      hitTestEngine: opts.hitTestEngine,
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

    this.areaSelectionManager = new AreaSelectionManager(
      opts.state,
      opts.bus,
      opts.getElements,
      opts.registerDirty,
      opts.hitTestEngine,
      opts.getGroupIdForElement ?? (() => undefined),
      opts.onGroupSelect,
    );

    this.bindEvents();
  }

  public setGesture(g: SelectionGesture): void {
    this.areaSelectionManager.setGesture(g);
  }

  public getGesture(): SelectionGesture {
    return this.areaSelectionManager.getGesture();
  }

  public setShortcuts(s: Partial<SelectionShortcuts>): void {
    this.shortcuts = { ...this.shortcuts, ...s };
  }

  public setSnapToCorners(enabled: boolean): void {
    this.dragHandler.setSnapToCorners(enabled);
  }

  public setSnapToPlanes(enabled: boolean): void {
    this.dragHandler.setSnapToPlanes(enabled);
  }

  public setSnapToArtboard(enabled: boolean): void {
    this.dragHandler.setSnapToArtboard(enabled);
  }

  public setAvoidCollisions(enabled: boolean): void {
    this.dragHandler.setAvoidCollisions(enabled);
  }

  public setSnapToGuidelines(enabled: boolean): void {
    this.dragHandler.setSnapToGuidelines(enabled);
  }

  public setSnapToGrid(enabled: boolean): void {
    this.dragHandler.setSnapToGrid(enabled);
  }

  public setSnapToElements(enabled: boolean): void {
    this.dragHandler.setSnapToElements(enabled);
  }

  public setLockDragAxis(enabled: boolean): void {
    this.dragHandler.setLockDragAxis(enabled);
  }

  public setSnapAxis(mode: SnapAxisMode): void {
    this.dragHandler.setSnapAxis(mode);
  }

  public setSnapRotation(enabled: boolean): void {
    this.opts.transformHandler.setSnapRotation(enabled);
    this.opts.groupTransformHandler.setSnapRotation(enabled);
  }

  public setRotationStep(step: number): void {
    this.opts.transformHandler.setRotationStep(step);
    this.opts.groupTransformHandler.setRotationStep(step);
  }

  public onMouseDown(e: MouseEvent): boolean {
    if (e.button !== 0) return false;

    if (this.opts.isCreating?.()) return false;
    if (this.opts.isTextEditing?.()) return false;

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
    const useRect =
      this.areaSelectionManager.getGesture() === 'rect' || this.shiftOverride;
    const isGroup = () => this.opts.state.mode === 'group';

    // Path node editing — проверка попадания по узлу/ручке
    if (this.nodeEdit.isActive) {
      if (this.nodeEdit.pointerDown(worldPt)) {
        e.preventDefault();
        return true;
      }
      // клик по пустому месту — снять выделение узлов, остаться в режиме
      this.nodeEdit.clickEmpty();
      e.preventDefault();
      return true;
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
      } else if (
        this.areaSelectionManager.onMouseDown(
          svgPt,
          worldPt,
          this.ctrlHeld,
          this.shiftOverride,
          'group',
          false,
        )
      ) {
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
    if (
      !this.opts.isCreating?.() &&
      !useRect &&
      this.areaSelectionManager.getGesture() !== 'lasso' &&
      !this.ctrlHeld
    ) {
      this.panAuto = true;
      this.panning = true;
      this.panStart = { x: svgPt.x, y: svgPt.y };
      this.panStartWorld = { x: worldPt.x, y: worldPt.y };
      rootSvg.style.cursor = 'grabbing';
      e.preventDefault();
      return true;
    }

    if (
      this.areaSelectionManager.onMouseDown(
        svgPt,
        worldPt,
        this.ctrlHeld,
        this.shiftOverride,
        'element',
        false,
      )
    ) {
      if (!this.ctrlHeld) this.opts.state.clear();
      return true;
    }

    const cmd = createSelectPickCommand('element', worldPt, this.ctrlHeld);
    this.opts.bus.execute(cmd);
    return true;
  }

  public onMouseMove(e: MouseEvent): boolean {
    if (e.buttons === 0) return false;
    if (this.opts.isCreating?.()) return false;

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

    if (this.nodeEdit.isDragging) {
      this.nodeEdit.pointerMove(worldPt);
      return true;
    }

    if (this.opts.transformHandler.isActive) {
      this.opts.transformHandler.move(worldPt, e.shiftKey);
      return true;
    }

    const areaHandled = this.areaSelectionManager.onMouseMove(
      svgPt,
      worldPt,
      isGroup() ? 'group' : 'element',
    );
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

    if (this.panning) {
      this.panning = false;
      this.opts.svg.style.cursor = '';
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

    if (this.opts.isCreating?.()) return false;

    const isGroup = () => this.opts.state.mode === 'group';
    const worldPt = this.screenToWorld(e);

    if (this.nodeEdit.isDragging) {
      this.nodeEdit.pointerUp();
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
      else if (
        this.areaSelectionManager.onMouseUp(worldPt, this.ctrlHeld, 'group')
      ) {
        return true;
      }
      return true;
    }

    if (this.dragHandler.isActive) {
      this.dragHandler.end();
      return true;
    }

    if (
      this.areaSelectionManager.onMouseUp(worldPt, this.ctrlHeld, 'element')
    ) {
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
    if (this.opts.isCreating?.()) return false;
    const worldPt = this.screenToWorld(e);

    if (this.nodeEdit.isActive) {
      this.nodeEdit.insertAt(worldPt.x, worldPt.y);
      e.preventDefault();
      return true;
    }

    const { hits } = this.opts.hitTestEngine.queryPoint(worldPt.x, worldPt.y);
    if (hits.length > 0) {
      const picked = hits[hits.length - 1] as AbstractGraphicElement;
      if (
        picked.type === 'path' ||
        picked.type === 'polyline' ||
        picked.type === 'polygon'
      ) {
        this.nodeEdit.enter([picked]);
        e.preventDefault();
        return true;
      } else if (picked.type === 'text') {
        this.opts.onTextEdit?.(picked);
        e.preventDefault();
        return true;
      } else if (picked.type === 'image') {
        const dto = (picked as ImageElement).toDTO();
        this.opts.events.emit('IMG_SELECT_EDIT', dto);
      }
    }
    return true;
  }

  public onKeyDown(e: KeyboardEvent): boolean {
    const key = e.key.toLowerCase();
    if (key === this.shortcuts.selectElement)
      this.areaSelectionManager.setGesture('click');
    else if (key === this.shortcuts.selectGroup) {
      this.areaSelectionManager.setGesture('click');
      this.opts.state.setMode('group');
    } else if (key === 'r') this.areaSelectionManager.setGesture('rect');
    else if (key === 'l') this.areaSelectionManager.setGesture('lasso');
    else if (key === 'v') {
      this.areaSelectionManager.setGesture('click');
      this.opts.state.setMode('element');
    } else if (key === 'escape') {
      this.opts.state.clear();
      this.opts.onGroupSelect?.([]);
      return true;
    }
    return false;
  }

  private bindEvents(): void {
    // Event delegation now handled by EventManager.
    // All logic moved to onMouseDown/Move/Up/DblClick/KeyDown methods.
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
    const { hits } = this.opts.hitTestEngine.queryPoint(wp.x, wp.y);
    const interactable = (hits as AbstractGraphicElement[]).filter(
      (h) => this.opts.canInteract?.(h.id) ?? true,
    );
    if (interactable.length === 0) return false;

    const picked = interactable[interactable.length - 1];
    const selectedIds = new Set(this.opts.state.selected.map((s) => s.id));

    if (!selectedIds.has(picked.id)) {
      const cmd = createSelectPickCommand('element', wp, false);
      this.opts.bus.execute(cmd);
      selectedIds.clear();
      selectedIds.add(picked.id);
    }

    const selected = all.filter((e) => selectedIds.has(e.id));
    const movable = selected.filter((e) => this.opts.canMove?.(e.id) ?? true);
    if (movable.length > 0) {
      this.dragHandler.startWithoutCheck(wp, movable);
      return true;
    }
    // выделили, но двигать нельзя
    return selected.length > 0;
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

    let groupOBB: {
      x: number;
      y: number;
      width: number;
      height: number;
      angle: number;
    } | null = null;
    for (const g of groups) {
      if (g.id === hit.targetId) {
        groupOBB = computeGroupOBB(g, findElement);
        break;
      }
    }
    if (!groupOBB) return false;

    return this.opts.groupTransformHandler.tryStart(
      hit.handle,
      groupOBB,
      worldPt,
      groups,
      findElement,
    );
  }
}
