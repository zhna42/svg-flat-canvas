import type { SvgCanvas } from '@/core/SvgCanvas';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { PathElement } from '@/shapes/elements/PathElement';
import type {
  BusEvent,
  GuidelineData,
  BooleanOp,
  SelectionMode,
  SelectionGesture,
  SelectionShortcuts,
  ElementJSON,
  TimeSnapshot,
  GroupConflictAction,
} from '@/types';
import type { Group } from '@/shapes/group';
import { createFromJSON, createFromJSONArray } from '@/shapes/elements/factory';
import { DebugLog } from '@/canvas/overlays/debug/DebugLog';
import {
  createCreateCommand,
  createCreateFileCommand,
  createDragMoveCommand,
  createResizeCommand,
  createRotateCommand,
  createTransformCommand,
} from '@/commands';
import type { ElementType, TransformMode, CreationElementType } from '@/types';
import { MM_TO_PX } from '@/constants';
import type {
  CreateShapeDTO,
  UpdateShapesDTO,
  DeleteShapesDTO,
  MoveShapesDTO,
  RotateShapesDTO,
  ResizeShapesDTO,
  SetTransformShapesDTO,
  GroupCreateDTO,
  GroupDeleteDTO,
  GroupAddElementsDTO,
  GroupRemoveElementsDTO,
  SelectShapesDTO,
  SortShapesDTO,
  StyleDTO,
  ElementGeometryDTO,
  RectGeometryDTO,
  CircleGeometryDTO,
  EllipseGeometryDTO,
  LineGeometryDTO,
  PathGeometryDTO,
  PolygonGeometryDTO,
  PolylineGeometryDTO,
  TextGeometryDTO,
  ImageGeometryDTO,
} from './dto';

let _idCounter = 0;
const generateId = (): string =>
  crypto.randomUUID?.() ?? `shape_${Date.now()}_${++_idCounter}`;

export class ExternalApi {
  private readonly canvas: SvgCanvas;
  private readonly dbg = new DebugLog();
  private fileCounter = 0;

  public constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  // ── Отладка ──

  /** Включить/выключить режим отладки */
  public setDebugMode(enabled: boolean): void {
    this.dbg.setEnabled(enabled);
  }

  // ── События ──

  /** Подписаться на событие */
  public on(type: string, fn: (event: BusEvent) => void): () => void {
    this.dbg.log('API', `on ${type}`);
    return this.canvas.events.on(type, fn);
  }

  /** Отписаться от события */
  public off(type: string, fn: (event: BusEvent) => void): void {
    this.dbg.log('API', `off ${type}`);
    this.canvas.events.off(type, fn);
  }

  // ── Создание фигур ──

  /** Создать фигуру из DTO */
  public createShape(dto: CreateShapeDTO): AbstractGraphicElement {
    this.dbg.log('API', 'createShape', { type: dto.type });
    const id = dto.id ?? generateId();
    const el = this.dtoToElement(id, dto.type, dto.geometry, dto.style);
    if (dto.transform) this.applyTransformDto(el, dto.transform);
    if (dto.name !== undefined) el.name = dto.name;
    if (dto.visible !== undefined) el.setVisible(dto.visible);
    if (dto.lock !== undefined) el.lock = dto.lock;
    if (dto.groupId !== undefined) el.groupId = dto.groupId ?? '';
    if (dto.data !== undefined || dto.laserData !== undefined) {
      el.data = { ...dto.data, laserData: dto.laserData };
    }
    this.canvas.commandBus.execute(createCreateCommand(el));
    return el;
  }

  /** Создать файл (набор фигур с общим groupId) */
  public createFile(
    dtos: CreateShapeDTO[],
    name?: string,
  ): { groupId: string; elements: AbstractGraphicElement[] } {
    this.dbg.log('API', 'createFile', { count: dtos.length, name });
    const elements: AbstractGraphicElement[] = [];
    const groupId = `file_${Date.now()}_${++this.fileCounter}`;
    const groupName = name ?? `file_${this.fileCounter}`;
    for (const dto of dtos) {
      const id = dto.id ?? generateId();
      const el = this.dtoToElement(id, dto.type, dto.geometry, dto.style);
      if (dto.transform) this.applyTransformDto(el, dto.transform);
      if (dto.name !== undefined) el.name = dto.name;
      if (dto.visible !== undefined) el.setVisible(dto.visible);
      if (dto.lock !== undefined) el.lock = dto.lock;
      if (dto.groupId !== undefined) el.groupId = dto.groupId ?? '';
      if (dto.data !== undefined || dto.laserData !== undefined) {
        el.data = { ...dto.data, laserData: dto.laserData };
      }
      elements.push(el);
    }
    this.canvas.commandBus.execute(
      createCreateFileCommand(elements, groupId, groupName),
    );
    return { groupId, elements };
  }

  // ── Управление фигурами ──

  /** Удалить фигуры */
  public deleteShapes(dto: DeleteShapesDTO): void {
    this.dbg.log('API', 'deleteShapes', { count: dto.elementIds.length });
    this.canvas.elementManager.deleteElements(dto.elementIds);
  }

  /** Удалить фигуру по ID */
  public deleteElement(id: string): void {
    this.canvas.elementManager.deleteElements([id]);
  }

  /** Удалить фигуры по IDs */
  public deleteElements(ids: string[]): void {
    this.canvas.elementManager.deleteElements(ids);
  }

  /** Обновить свойства фигур */
  public updateShapes(dto: UpdateShapesDTO): void {
    this.dbg.log('API', 'updateShapes', { count: dto.elementIds.length });
    const elements = this.findElements(dto.elementIds);
    for (const el of elements) {
      if (dto.style) this.applyStyleDto(el, dto.style);
      if (dto.transform) this.applyTransformDto(el, dto.transform);
      if (dto.geometry) this.applyGeometryDelta(el, dto.geometry);
      if (dto.name !== undefined) el.name = dto.name;
      if (dto.visible !== undefined) el.setVisible(dto.visible);
      if (dto.lock !== undefined) el.lock = dto.lock;
      if (dto.groupId !== undefined) el.groupId = dto.groupId;
      if (dto.data !== undefined) {
        el.data = { ...el.data, ...dto.data };
      }
    }
  }

  /** Переместить фигуры */
  public moveShapes(dto: MoveShapesDTO): void {
    this.dbg.log('API', 'moveShapes', {
      count: dto.elementIds.length,
      delta: dto.delta,
    });
    this.canvas.commandBus.execute(
      createDragMoveCommand('element', dto.delta, dto.elementIds),
    );
  }

  /** Повернуть фигуры */
  public rotateShapes(dto: RotateShapesDTO): void {
    this.dbg.log('API', 'rotateShapes', {
      count: dto.elementIds.length,
      angle: dto.angle,
    });
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createRotateCommand(dto.elementIds, dto.angle),
    );
  }

  /** Изменить размер фигур */
  public resizeShapes(dto: ResizeShapesDTO): void {
    this.dbg.log('API', 'resizeShapes', { count: dto.elementIds.length });
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createResizeCommand(dto.elementIds, dto.bbox),
    );
  }

  /** Установить трансформацию фигур */
  public setTransformShapes(dto: SetTransformShapesDTO): void {
    this.dbg.log('API', 'setTransformShapes', { count: dto.elementIds.length });
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createTransformCommand(dto.elementIds, dto.matrix),
    );
  }

  /** Изменить размер элемента по ID */
  public resizeElement(id: string, _width: number, _height: number): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    const bbox = el.getTransformedBBox();
    if (bbox.width > 0) {
      el.transform.scale({
        x: 0,
        y: 0,
        originX: bbox.x,
        originY: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
      el.rebuildHitArea();
    }
  }

  /** Повернуть элемент по ID */
  public rotateElement(id: string, angle: number): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.rotate(angle, el.getLocalCenter());
    el.rebuildHitArea();
  }

  /** Трансформировать элемент по ID */
  public transformElement(
    id: string,
    matrix: [number, number, number, number, number, number],
  ): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.matrix = new DOMMatrix(matrix);
    el.rebuildHitArea();
  }

  /** Обвести элемент в контур */
  public outlineElement(id: string): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    const outline = el.toOutlinePath();
    this.canvas.hitTestEngine.remove(el.id);
    this.canvas.shapeManager.removeElementAndNode(el.id);
    this.canvas.shapeManager.addElement(outline);
    this.addShape(outline);
    this.canvas.events.emit('element-outlined', { id, newId: outline.id });
  }

  /** Получить контур элемента */
  public getOutlinePath(id: string): Record<string, unknown> | null {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return null;
    const path = el.toOutlinePath();
    return path.toDTO();
  }

  // ── Выделение ──

  /** Выбрать фигуры */
  public selectShapes(dto: SelectShapesDTO): void {
    this.dbg.log('API', 'selectShapes', {
      count: dto.elementIds.length,
      toggle: dto.toggle,
    });
    const elements = this.findElements(dto.elementIds);
    if (dto.toggle) {
      const current = [...this.getSelected()];
      for (const el of elements) {
        const idx = current.findIndex((s) => s.id === el.id);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(el);
        }
      }
      this.canvas.selectionState.replace(current);
    } else {
      this.canvas.selectionState.replace(elements);
    }
  }

  /** Очистить выделение */
  public clearSelection(): void {
    this.dbg.log('API', 'clearSelection');
    this.canvas.selectionState.replace([]);
  }

  /** Выбрать элементы по IDs */
  public selectElements(ids: string[]): void {
    this.canvas.elementManager.selectElements(ids);
  }

  /** Установить режим выделения */
  public setSelectionMode(mode: SelectionMode): void {
    this.canvas.selectionState.setMode(mode);
  }

  /** Получить текущий режим выделения */
  public getSelectionMode(): SelectionMode {
    return this.canvas.selectionState.mode;
  }

  /** Получить выбранные элементы */
  public getSelected(): readonly AbstractGraphicElement[] {
    return this.canvas.selectionState.selected;
  }

  /** Установить выбранные элементы напрямую */
  public setSelectedElements(elements: AbstractGraphicElement[]): void {
    this.canvas.selectionState.replace(elements);
  }

  /** Получить стили выбранных элементов */
  public getSelectedStyles(): Array<Record<string, unknown>> {
    return this.canvas.elementManager.getSelectedStyles();
  }

  /** Получить все фигуры */
  public getAllShapes(): readonly AbstractGraphicElement[] {
    this.dbg.log('API', 'getAllShapes');
    return this.canvas.shapeManager.getAll();
  }

  /** Получить элемент по ID */
  public getElementById(id: string): Record<string, unknown> | null {
    this.dbg.log('API', 'getElementById', id);
    const el = this.canvas.shapeManager.getById(id) as
      | AbstractGraphicElement
      | undefined;
    if (!el) return null;
    return el.toDTO();
  }

  /** Сортировать фигуры (сменить порядок) */
  public sortShapes(dto: SortShapesDTO): void {
    this.dbg.log('API', 'sortShapes', {
      count: dto.elementIds.length,
      position: dto.position,
    });
    // TODO: implement layer reordering
  }

  /** Переместить элемент в слое */
  public reorderElement(
    _id: string,
    _position: 'before' | 'after',
    _targetId: string,
  ): void {
    // TODO: implement layer reordering
  }

  // ── Быстрые клавиши выделения ──

  public setSelectionShortcuts(s: Partial<SelectionShortcuts>): void {
    this.canvas.selectionHandler.setShortcuts(s);
  }

  public setSelectionGesture(g: SelectionGesture): void {
    this.canvas.selectionHandler.setGesture(g);
  }

  public getSelectionGesture(): SelectionGesture {
    return this.canvas.selectionHandler.getGesture();
  }

  // ── Группы ──

  /** Создать группу */
  public groupCreate(dto: GroupCreateDTO): string {
    this.dbg.log('API', 'groupCreate', { name: dto.name });
    return this.canvas.groupManager.createGroup(dto.name);
  }

  /** Удалить группу */
  public groupDelete(dto: GroupDeleteDTO): void {
    this.dbg.log('API', 'groupDelete', { groupId: dto.groupId });
    this.canvas.groupManager.deleteGroup(dto.groupId);
  }

  /** Добавить элементы в группу */
  public groupAddElements(dto: GroupAddElementsDTO): void {
    this.dbg.log('API', 'groupAddElements', {
      groupId: dto.groupId,
      count: dto.elementIds.length,
    });
    for (const elementId of dto.elementIds) {
      this.canvas.groupManager.addToGroup(dto.groupId, elementId);
    }
  }

  /** Удалить элементы из группы */
  public groupRemoveElements(dto: GroupRemoveElementsDTO): void {
    this.dbg.log('API', 'groupRemoveElements', {
      groupId: dto.groupId,
      count: dto.elementIds.length,
    });
    for (const elementId of dto.elementIds) {
      this.canvas.groupManager.removeFromGroup(dto.groupId, elementId);
    }
  }

  /** Получить список групп */
  public getGroups(): Group[] {
    this.dbg.log('API', 'getGroups');
    return this.canvas.groupManager.getGroups();
  }

  /** Выбрать группу */
  public selectGroup(id: string): void {
    this.dbg.log('API', 'selectGroup', { id });
    this.canvas.selectionState.clear();
    this.canvas.groupManager.setSelectedGroupIds([id]);
    this.syncGroupOverlay();
  }

  /** Выбрать элементы группы */
  public selectGroupElements(id: string): void {
    this.dbg.log('API', 'selectGroupElements', { id });
    const ids = this.canvas.groupManager.getElementIdsInGroup(id);
    this.canvas.selectionState.replace(
      this.canvas.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  /** Получить ID элементов в группе */
  public getElementIdsInGroup(id: string): string[] {
    this.dbg.log('API', 'getElementIdsInGroup', { id });
    return this.canvas.groupManager.getElementIdsInGroup(id);
  }

  /** Выбрать несколько групп */
  public selectMultipleGroups(ids: string[]): void {
    this.canvas.groupManager.setSelectedGroupIds(ids);
    this.syncGroupOverlay();
  }

  /** Подсветить элементы группы */
  public highlightGroupElements(id: string): void {
    const ids = this.canvas.groupManager.getElementIdsInGroup(id);
    this.canvas.selectionState.replace(
      this.canvas.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  /** Выбрать группу вместе с её элементами */
  public selectGroupWithElements(id: string): void {
    this.canvas.groupManager.setSelectedGroupIds([id]);
    this.syncGroupOverlay();
    const ids = this.canvas.groupManager.getElementIdsInGroup(id);
    this.canvas.selectionState.replace(
      this.canvas.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  /** Очистить группу (удалить все элементы из группы) */
  public clearGroup(id: string): void {
    this.canvas.groupManager.clearGroup(id);
  }

  // ── Колбэки групп ──

  public get onGroupsChange(): (() => void) | null {
    return null;
  }
  public set onGroupsChange(fn: (() => void) | null) {
    this.canvas.groupManager.setOnChange(fn);
  }

  public get onGroupConflict():
    | ((
        elementId: string,
        fromGroup: string,
        toGroup: string,
      ) => GroupConflictAction | null)
    | null {
    return this.canvas.groupManager.onConflict;
  }
  public set onGroupConflict(
    fn:
      | ((
          elementId: string,
          fromGroup: string,
          toGroup: string,
        ) => GroupConflictAction | null)
      | null,
  ) {
    this.canvas.groupManager.onConflict = fn;
  }

  public get groupConflictSuppressed(): boolean {
    return this.canvas.groupManager.conflictSuppressed;
  }
  public set groupConflictSuppressed(v: boolean) {
    this.canvas.groupManager.conflictSuppressed = v;
  }

  // ── Размеры холста ──

  /** Получить размер холста */
  public getCanvasSize(): {
    widthMM: number;
    heightMM: number;
    widthPx: number;
    heightPx: number;
    pxPerMM: number;
  } {
    this.dbg.log('API', 'getCanvasSize');
    const artboard = this.canvas.artboard;
    const wMM = artboard.widthMM;
    const hMM = artboard.heightMM;
    return {
      widthMM: wMM,
      heightMM: hMM,
      widthPx: wMM * MM_TO_PX,
      heightPx: hMM * MM_TO_PX,
      pxPerMM: MM_TO_PX,
    };
  }

  /** Установить размер артборда */
  public setArtboardSize(widthMM: number, heightMM: number): void {
    this.canvas.artboard?.setSize(widthMM, heightMM);
    const vb = this.canvas.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    const viewW = parts[2] || 800;
    const viewH = parts[3] || 600;
    const ctm = this.canvas.svg.getScreenCTM();
    let realW = viewW;
    let realH = viewH;
    if (ctm) {
      const rect = this.canvas.svg.getBoundingClientRect();
      const inv = ctm.inverse();
      const p = this.canvas.svg.createSVGPoint();
      p.x = rect.width;
      p.y = rect.height;
      const vp = p.matrixTransform(inv);
      realW = vp.x;
      realH = vp.y;
    }
    this.canvas.camera.fitToViewport(
      widthMM * 3.7795,
      heightMM * 3.7795,
      realW,
      realH,
      40,
    );
    this.canvas.events.emit('artboard-resized', { widthMM, heightMM });
  }

  /** Получить Camera для ручного управления zoom/pan */
  public getCamera(): import('@/canvas/Camera').Camera {
    return this.canvas.camera as any;
  }

  // ── Режимы панорамирования и создания ──

  /** Включить/выключить режим панорамирования */
  public setPanMode(enabled: boolean): void {
    this.dbg.log('API', 'setPanMode', { enabled });
    this.canvas.panActive.value = enabled;
    if (enabled) {
      this.canvas.creationHandler.setActiveType(null);
    }
    this.canvas.events.emit('SVG_CAD_PAN_MODE_CHANGED', { enabled });
  }

  // ── Редактирование пути ──

  /** Текущий редактируемый PathElement */
  _editingPath: PathElement | null = null;
  _editingPathUnsub: (() => void) | null = null;

  public get editingPath(): PathElement | null {
    return this._editingPath;
  }

  public set editingPath(path: PathElement | null) {
    if (this._editingPath && this._editingPath !== path) {
      this._editingPath.isNodeEditing = false;
      if (this._editingPathUnsub) {
        this._editingPathUnsub();
        this._editingPathUnsub = null;
      }
    }
    this._editingPath = path;
    this.canvas.creationHandler.editingPathElement = path;
    if (path) {
      path.isNodeEditing = true;
      this._editingPathUnsub = path.subscribe('geometry.commands', () => {
        this.canvas.pathNodeOverlay.updatePathNodes(path);
      });
      this.canvas.pathNodeOverlay.renderPathNodes(path);
    } else {
      this.canvas.selectionManager.clear();
    }
  }

  /** Добавить фигуру на холст */
  public addShape(shape: AbstractGraphicElement): void {
    this.canvas.elementManager.addShape(shape);
    shape.clearTimeMachineDiff();
  }

  /** Загрузить JSON с элементами */
  public loadJSON(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.canvas.elementManager.addShape(el);
    }
    this.canvas.timeMachine.clear();
  }

  /** Уничтожить холст */
  public destroy(): void {
    this.canvas.svg.remove();
    this.canvas.eventManager.destroy();
    this.canvas.shapeManager.clear();
    this.canvas.groupManager.destroy();
  }

  /** Показать/скрыть hit area у элементов */
  _debugShowHitArea = false;

  public get debugShowHitArea(): boolean {
    return this._debugShowHitArea;
  }
  public set debugShowHitArea(v: boolean) {
    this._debugShowHitArea = v;
    this.canvas.debugOverlay.update(v ? this.canvas.shapeManager.getAll() : []);
  }

  /** Установить активный инструмент создания фигур */
  public setActiveCreationTool(type: ElementType | null): void {
    this.dbg.log('API', 'setActiveCreationTool', { type });
    if (type !== null) {
      this.canvas.panActive.value = false;
    }
    const allowed: ElementType[] = [
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'path',
    ];
    if (type === null || (allowed as string[]).includes(type)) {
      this.canvas.creationHandler.setActiveType(
        type as CreationElementType | null,
      );
    }
  }

  // ── Трансформация ──

  /** Установить режим трансформации */
  public setTransformMode(mode: TransformMode): void {
    this.canvas.transformHandler.setMode(mode);
    this.canvas.groupTransformHandler.setMode(mode);
  }

  /** Включить/выключить пропорциональное изменение размера */
  public setProportionalResize(enabled: boolean): void {
    this.canvas.transformHandler.setProportionalResize(enabled);
    this.canvas.groupTransformHandler.setProportionalResize(enabled);
    this.canvas.events.emit('PROPORTIONAL_RESIZE_TOGGLED', { enabled });
  }

  /** Включить/выключить прилипание угла поворота к сетке */
  public setSnapRotation(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapRotation(enabled);
    this.canvas.events.emit('ROTATION_SNAP_TOGGLED', { enabled });
  }

  /** Установить шаг прилипания угла поворота в градусах (по умолчанию 15) */
  public setRotationStep(step: number): void {
    this.canvas.selectionHandler.setRotationStep(step);
    this.canvas.events.emit('ROTATION_STEP_CHANGED', { step });
  }

  // ── Снап ──

  public setSnapToCorners(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToCorners(enabled);
  }
  public setSnapToPlanes(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToPlanes(enabled);
  }
  public setSnapToArtboard(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToArtboard(enabled);
  }
  public setAvoidCollisions(enabled: boolean): void {
    this.canvas.selectionHandler.setAvoidCollisions(enabled);
  }
  public setSnapToGuidelines(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToGuidelines(enabled);
  }
  public setSnapToGrid(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToGrid(enabled);
  }
  public setSnapToElements(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapToElements(enabled);
  }
  public setLockDragAxis(enabled: boolean): void {
    this.canvas.selectionHandler.setLockDragAxis(enabled);
    this.canvas.events.emit('DRAG_AXIS_LOCK_CHANGED', { enabled });
  }
  public setSnapAxis(mode: 'both' | 'horizontal' | 'vertical'): void {
    this.canvas.selectionHandler.setSnapAxis(mode);
  }

  // ── Линейки и направляющие ──

  public setRulersVisible(v: boolean): void {
    this.canvas.rulers.setVisible(v);
    this.canvas.guidelineManager.setRulersVisible(v);
  }
  public getRulersVisible(): boolean {
    return this.canvas.rulers.visible;
  }
  public addGuideline(orientation: 'v' | 'h', position: number): string {
    return this.canvas.guidelineManager.addGuideline(orientation, position);
  }
  public removeGuideline(id: string): void {
    this.canvas.guidelineManager.removeGuideline(id);
  }
  public getGuidelines(): GuidelineData[] {
    return this.canvas.guidelineManager.getGuidelines();
  }
  public setGuidelinesVisible(orientation: 'v' | 'h', v: boolean): void {
    this.canvas.guidelineManager.setGuidelinesVisible(orientation, v);
  }
  public getGuidelinesVisible(orientation: 'v' | 'h'): boolean {
    return this.canvas.guidelineManager.getGuidelinesVisible(orientation);
  }

  // ── Булевы операции ──

  public enterBooleanMode(op: BooleanOp): void {
    this.canvas.booleanHandler.enterMode(op);
  }
  public exitBooleanMode(): void {
    this.canvas.booleanHandler.exitMode();
  }

  // ── История ──

  /** Отменить последнее действие */
  public undo(): void {
    if (this.editingPath) return;
    this.canvas.selectionState.clear();
    this.canvas.groupManager.clearSelectedGroups();
    this.canvas.selectionManager.clear();
    this.canvas.timeMachine.undo();
    this.canvas.elementManager.reindexAll();
  }

  /** Повторить отменённое действие */
  public redo(): void {
    if (this.editingPath) return;
    this.canvas.selectionState.clear();
    this.canvas.groupManager.clearSelectedGroups();
    this.canvas.selectionManager.clear();
    this.canvas.timeMachine.redo();
    this.canvas.elementManager.reindexAll();
  }

  /** Можно ли отменить */
  public get canUndo(): boolean {
    return this.canvas.timeMachine.canUndo;
  }
  /** Можно ли повторить */
  public get canRedo(): boolean {
    return this.canvas.timeMachine.canRedo;
  }

  /** Сохранить историю в JSON */
  public saveTimeMachine(): TimeSnapshot[] {
    return this.canvas.timeMachine.toJSON();
  }

  /** Восстановить историю из JSON */
  public loadTimeMachine(records: TimeSnapshot[]): void {
    this.canvas.shapeManager.clear();
    this.canvas.groupManager.setGroups([]);
    this.canvas.hitTestEngine.reindexAll([]);
    this.canvas.timeMachine.fromJSON(records);
  }

  // ── Прелоадер ──

  public showPreloader(): void {
    if (this.canvas.preloaderOverlay.visible) return;
    const vb = this.canvas.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    this.canvas.preloaderOverlay.showCentered(parts[2] || 800, parts[3] || 600);
    this.canvas.events.emit('preloader-toggled', { visible: true });
  }

  public hidePreloader(): void {
    if (!this.canvas.preloaderOverlay.visible) return;
    this.canvas.preloaderOverlay.hide();
    this.canvas.events.emit('preloader-toggled', { visible: false });
  }

  public isPreloaderVisible(): boolean {
    return this.canvas.preloaderOverlay.visible;
  }

  // ── Сетка ──

  public showGrid(): void {
    if (this.canvas.gridOverlay.visible) return;
    this.canvas.gridOverlay.show();
    this.canvas.events.emit('grid-toggled', { visible: true });
  }

  public hideGrid(): void {
    if (!this.canvas.gridOverlay.visible) return;
    this.canvas.gridOverlay.hide();
    this.canvas.events.emit('grid-toggled', { visible: false });
  }

  public isGridVisible(): boolean {
    return this.canvas.gridOverlay.visible;
  }
  public setGridStep(mm: number): void {
    this.canvas.gridOverlay.setStep(mm);
    this.canvas.events.emit('grid-step-changed', { stepMM: mm });
  }
  public getGridStep(): number {
    return this.canvas.gridOverlay.stepMM;
  }

  // ── Цветовые карты ──

  public getFillColorMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.canvas.elementManager.getFillColorMap()) {
      result[key] = Array.from(set);
    }
    return result;
  }
  public getStrokeColorMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.canvas.elementManager.getStrokeColorMap()) {
      result[key] = Array.from(set);
    }
    return result;
  }
  public recalculateColorMaps(): void {
    this.canvas.elementManager.recalculateColorMaps();
  }
  public setColorQuantStep(step: number): void {
    this.canvas.elementManager.setColorQuantStep(step);
  }

  // ── Загрузка/выгрузка данных ──

  /** Получить несохранённые DTO элементов */
  public getUnsavedDTOs(): Array<Record<string, unknown>> {
    return this.canvas.elementManager.getUnsavedDTOs();
  }
  public getUnsavedGroupDTOs(): Array<Record<string, unknown>> {
    return this.canvas.groupManager.getUnsavedDTOs();
  }

  // ── Массовые операции с элементами ──

  public loadElements(dtos: Record<string, unknown>[]): void {
    this.canvas.elementManager.loadElements(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        type: d.type as ElementType,
        attributes: (d.attributes ?? d) as Record<string, string>,
        groupId: d.groupId as string | undefined,
        name: d.name as string | undefined,
        visible: d.visible as boolean | undefined,
        lock: d.lock as boolean | undefined,
        data: d.data as Record<string, unknown> | undefined,
      })),
    );
  }

  public addElements(dtos: Record<string, unknown>[]): void {
    this.canvas.elementManager.addElements(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        type: d.type as ElementType,
        attributes: (d.attributes ?? d) as Record<string, string>,
        groupId: d.groupId as string | undefined,
        name: d.name as string | undefined,
        visible: d.visible as boolean | undefined,
        lock: d.lock as boolean | undefined,
        data: d.data as Record<string, unknown> | undefined,
      })),
    );
  }

  public replaceElements(dtos: Record<string, unknown>[]): void {
    this.canvas.elementManager.replaceElements(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        type: d.type as ElementType,
        attributes: (d.attributes ?? d) as Record<string, string>,
        groupId: d.groupId as string | undefined,
        name: d.name as string | undefined,
        visible: d.visible as boolean | undefined,
        lock: d.lock as boolean | undefined,
        data: d.data as Record<string, unknown> | undefined,
      })),
    );
  }

  public updateElements(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    this.canvas.elementManager.updateElements(patches);
  }

  public loadGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.groupManager.loadGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  public addGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.groupManager.addGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  public replaceGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.groupManager.replaceGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  public updateGroups(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    this.canvas.groupManager.updateGroups(patches);
  }

  // ── Приватные методы ──

  private syncGroupOverlay(): void {
    const selectedGroups = Array.from(this.canvas.groupManager.selectedGroupIds)
      .map((id) => this.canvas.groupManager.getGroup(id))
      .filter((g): g is Group => g !== undefined);
    this.canvas.selectionManager.setGroupSelection(
      selectedGroups.map((g) => g.id),
      (id) => this.canvas.groupManager.getGroup(id),
      (id) => this.canvas.shapeManager.getAll().find((e) => e.id === id),
    );
  }

  private findElements(ids: string[]): AbstractGraphicElement[] {
    const all = this.canvas.shapeManager.getAll();
    return all.filter((e) => ids.includes(e.id));
  }

  private dtoToElement(
    id: string,
    type: ElementType,
    geometry: ElementGeometryDTO,
    style?: StyleDTO,
  ): AbstractGraphicElement {
    const attrs: Record<string, string> = this.geometryToAttrs(type, geometry);
    if (style) {
      if (style.fill !== undefined) attrs.fill = style.fill;
      if (style.stroke !== undefined) attrs.stroke = style.stroke;
      if (style.strokeWidth !== undefined)
        attrs['stroke-width'] = String(style.strokeWidth);
      if (style.opacity !== undefined) attrs.opacity = String(style.opacity);
      if (style.visible !== undefined)
        attrs.visibility = style.visible ? 'visible' : 'hidden';
    }
    return createFromJSON({ id, type, attributes: attrs });
  }

  private geometryToAttrs(
    type: ElementType,
    geo: ElementGeometryDTO,
  ): Record<string, string> {
    const attrs: Record<string, string> = {};
    switch (type) {
      case 'rect': {
        const r = geo as RectGeometryDTO;
        attrs.x = String(r.x);
        attrs.y = String(r.y);
        attrs.width = String(r.width);
        attrs.height = String(r.height);
        if (r.rx !== undefined) attrs.rx = String(r.rx);
        if (r.ry !== undefined) attrs.ry = String(r.ry);
        break;
      }
      case 'circle': {
        const c = geo as CircleGeometryDTO;
        attrs.cx = String(c.cx);
        attrs.cy = String(c.cy);
        attrs.r = String(c.r);
        break;
      }
      case 'ellipse': {
        const e = geo as EllipseGeometryDTO;
        attrs.cx = String(e.cx);
        attrs.cy = String(e.cy);
        attrs.rx = String(e.rx);
        attrs.ry = String(e.ry);
        break;
      }
      case 'line': {
        const l = geo as LineGeometryDTO;
        attrs.x1 = String(l.x1);
        attrs.y1 = String(l.y1);
        attrs.x2 = String(l.x2);
        attrs.y2 = String(l.y2);
        break;
      }
      case 'path':
        attrs.d = (geo as PathGeometryDTO).d;
        break;
      case 'polygon':
        attrs.points = (geo as PolygonGeometryDTO).points;
        break;
      case 'polyline':
        attrs.points = (geo as PolylineGeometryDTO).points;
        break;
      case 'text': {
        const t = geo as TextGeometryDTO;
        attrs.x = t.x;
        attrs.y = t.y;
        if (t.fontSize !== undefined) attrs['font-size'] = t.fontSize;
        if (t.fontFamily !== undefined) attrs['font-family'] = t.fontFamily;
        if (t.textAnchor !== undefined) attrs['text-anchor'] = t.textAnchor;
        if (t.textContent !== undefined) attrs.textContent = t.textContent;
        break;
      }
      case 'image': {
        const img = geo as ImageGeometryDTO;
        attrs.x = String(img.x);
        attrs.y = String(img.y);
        attrs.width = String(img.width);
        attrs.height = String(img.height);
        attrs.href = img.href;
        break;
      }
    }
    return attrs;
  }

  private applyStyleDto(
    el: AbstractGraphicElement,
    style: Partial<StyleDTO>,
  ): void {
    if (style.fill !== undefined) el.style.fill = style.fill;
    if (style.stroke !== undefined) el.style.stroke = style.stroke;
    if (style.strokeWidth !== undefined)
      el.style.strokeWidth = style.strokeWidth;
    if (style.opacity !== undefined) el.style.opacity = style.opacity;
    if (style.visible !== undefined) el.setVisible(style.visible);
  }

  private applyTransformDto(
    el: AbstractGraphicElement,
    t: Partial<{
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      matrix: [number, number, number, number, number, number];
    }>,
  ): void {
    if (t.matrix) {
      el.transform.matrix = new DOMMatrix(t.matrix);
      el.rebuildHitArea();
      return;
    }
    const { x, y, scaleX, scaleY, angle } = t;
    if (x !== undefined || y !== undefined) {
      const dx = x !== undefined ? x - el.transform.x : 0;
      const dy = y !== undefined ? y - el.transform.y : 0;
      if (dx !== 0 || dy !== 0) el.transform.translate(dx, dy);
    }
    if (scaleX !== undefined || scaleY !== undefined) {
      const center = el.getCenter();
      el.transform.scale({
        x: 0,
        y: 0,
        originX: center.x,
        originY: center.y,
        width: el.getTransformedBBox().width,
        height: el.getTransformedBBox().height,
      });
    }
    if (angle !== undefined)
      el.transform.rotate(angle - el.transform.angle, el.getLocalCenter());
    el.rebuildHitArea();
  }

  private applyGeometryDelta(
    el: AbstractGraphicElement,
    geo: Partial<ElementGeometryDTO>,
  ): void {
    const snapshot = el.toDTO().attributes as Record<string, unknown>;
    const merged = { ...snapshot, ...geo };
    el.applyDTO(merged);
  }

  // ── Spatial index and color maps ──

  indexShape(shape: AbstractGraphicElement): void {
    this.canvas.elementManager.indexShape(shape);
  }

  reindexElement(el: AbstractGraphicElement): void {
    this.canvas.elementManager.reindexElement(el);
  }

  reindexSpatialGrid(): void {
    this.canvas.elementManager.reindexAll();
  }
}
