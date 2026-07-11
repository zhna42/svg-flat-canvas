import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { PathElement } from '@/core/shapes/elements/PathElement';
import { PathElement as PathElementCtor } from '@/core/shapes/elements/PathElement';
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
} from '@/core/type';
import type { Group } from '@/core/shapes/group';
import {
  FlexTree,
  FLEX_TREE_PRESETS,
  FLEX_VALIDATION,
  type FlexTreeAlgorithm,
} from '@/core/math/flex-tree';
import { createFromJSON, createFromJSONArray } from '@/core/shapes/factory';
import { UseElement } from '@/core/shapes/elements/UseElement';
import { DebugLog } from '@/canvas/overlays/debug/DebugLog';
import type { LaserLayerData } from '@/modules/laser/layers';
import {
  createCreateCommand,
  createCreateFileCommand,
  createDragMoveCommand,
  createResizeCommand,
  createRotateCommand,
  createTransformCommand,
} from '@/core/commands';
import type {
  ElementType,
  TransformMode,
  CreationElementType,
  NodeKind,
  MeasureTool,
  ProtractorMode,
  MeasureResult,
} from '@/core/type';
import type {
  LaserGroupCreateDTO,
  LaserGroupData,
  LaserGroupFields,
  LaserOpType,
  LaserSettingsInfo,
} from '@/modules/laser';
import type { TextController } from '@/modules/text';
import type { TextStylePatch } from '@/modules/text';
type TextControllerType = TextController;
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
} from './dto-types';

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
    if (!this._guardEditMode())
      return null as unknown as AbstractGraphicElement;
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
    if (!this._guardEditMode()) return;
    this._purgeLaser(dto.elementIds);
    this.canvas.elementManager.deleteElements(dto.elementIds);
  }

  /** Удалить фигуру по ID */
  public deleteElement(id: string): void {
    this._purgeLaser([id]);
    this.canvas.elementManager.deleteElements([id]);
  }

  /** Удалить фигуры по IDs */
  public deleteElements(ids: string[]): void {
    this._purgeLaser(ids);
    this.canvas.elementManager.deleteElements(ids);
  }

  private _purgeLaser(ids: string[]): void {
    for (const id of ids) this.canvas.laserGroupManager.purgeElement(id);
  }

  /** Обновить свойства фигур */
  public updateShapes(dto: UpdateShapesDTO): void {
    if (!this._guardEditMode()) return;
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
    if (!this._guardEditMode()) return;
    this.canvas.commandBus.execute(
      createDragMoveCommand('element', dto.delta, dto.elementIds),
    );
  }

  /** Повернуть фигуры */
  public rotateShapes(dto: RotateShapesDTO): void {
    if (!this._guardEditMode()) return;
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createRotateCommand(dto.elementIds, dto.angle),
    );
  }

  /** Изменить размер фигур */
  public resizeShapes(dto: ResizeShapesDTO): void {
    if (!this._guardEditMode()) return;
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createResizeCommand(dto.elementIds, dto.bbox),
    );
  }

  /** Установить трансформацию фигур */
  public setTransformShapes(dto: SetTransformShapesDTO): void {
    if (!this._guardEditMode()) return;
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createTransformCommand(dto.elementIds, dto.matrix),
    );
  }

  /** Изменить размер элемента по ID (ширина и высота в мм). */
  public resizeElement(id: string, widthMm: number, heightMm: number): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    const bbox = el.getTransformedBBox();
    if (bbox.width <= 0 || bbox.height <= 0) return;
    const wPx = widthMm * MM_TO_PX;
    const hPx = heightMm * MM_TO_PX;
    const fx = wPx / bbox.width;
    const fy = hPx / bbox.height;
    const ox = bbox.x;
    const oy = bbox.y;
    const scaled = new DOMMatrix()
      .translateSelf(ox, oy)
      .scaleSelf(fx, fy)
      .translateSelf(-ox, -oy)
      .multiply(el.transform.matrix);
    scaled.e = Math.round(scaled.e);
    scaled.f = Math.round(scaled.f);
    el.transform.matrix = scaled;
    el.rebuildHitArea();
    void this._emitSize(el.id);
  }

  /** Эмитировать ELEMENT_SIZE с размерами в мм по bounding box. */
  private _emitSize(id: string): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    this._refreshSelectionOverlay();
    const bbox = el.getTransformedBBox();
    this.canvas.events.emit('ELEMENT_SIZE', {
      id,
      widthMm: bbox.width / MM_TO_PX,
      heightMm: bbox.height / MM_TO_PX,
      angleDeg: el.transform.angle,
    });
  }

  /** Пересчитать рамку выделения после программной трансформации. */
  private _refreshSelectionOverlay(): void {
    this.canvas.selectionManager.syncElementPositions((id) =>
      this.canvas.shapeManager.getAll().find((e) => e.id === id),
    );
  }

  /** Повернуть элемент по ID */
  public rotateElement(id: string, angle: number): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.rotate(angle, el.getLocalCenter());
    el.rebuildHitArea();
    this._emitSize(id);
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
    if (!this._guardEditMode()) return;
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
    const wUnits = widthMM * MM_TO_PX;
    const hUnits = heightMM * MM_TO_PX;
    this.canvas.svg.setAttribute('viewBox', `0 0 ${wUnits} ${hUnits}`);
    const ctm = this.canvas.svg.getScreenCTM();
    let realW = wUnits;
    let realH = hUnits;
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
    this.canvas.camera.fitToViewport(wUnits, hUnits, realW, realH, 40);
    if (this.canvas.rulers.flipY) {
      this.canvas.rulers.setFlipY(true, hUnits);
    }
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

  // ── Редактирование узлов (path / polyline / polygon) ──

  /** Войти в режим редактирования узлов для указанных элементов. */
  public enterNodeEdit(ids: string[]): void {
    const els = ids
      .map((id) => this.canvas.shapeManager.getById(id))
      .filter((e): e is AbstractGraphicElement => !!e);
    if (els.length > 0) this.canvas.nodeEdit.enter(els);
  }

  /** Выйти из режима редактирования узлов. */
  public exitNodeEdit(): void {
    this.canvas.nodeEdit.exit();
  }

  /** Активен ли режим редактирования узлов. */
  public get isNodeEditing(): boolean {
    return this.canvas.nodeEdit.isActive;
  }

  /** Множественный выбор точек: клик добавляет/убирает точку. */
  public setNodeMultiSelect(on: boolean): void {
    this.canvas.nodeEdit.setMultiSelect(on);
  }
  public getNodeMultiSelect(): boolean {
    return this.canvas.nodeEdit.getMultiSelect();
  }

  /** Изменить тип выбранных точек. */
  public setSelectedNodesType(kind: NodeKind): void {
    this.canvas.nodeEdit.setSelectedType(kind);
  }

  /** Сгладить выбранные точки (превратить в сглаженную кривую). */
  public smoothSelectedNodes(): void {
    this.canvas.nodeEdit.smoothSelected();
  }

  /** Сделать выбранные точки острыми (отрезки без сглаживания). */
  public sharpenSelectedNodes(): void {
    this.canvas.nodeEdit.sharpenSelected();
  }

  /** Удалить выбранные точки. */
  public deleteSelectedNodes(): void {
    this.canvas.nodeEdit.deleteSelected();
  }

  /** Расставить выбранные точки на равном расстоянии. */
  public distributeSelectedNodesEvenly(): void {
    this.canvas.nodeEdit.distributeEvenly();
  }

  /** Сдвинуть выбранные точки (для стрелок в приложении). */
  public nudgeSelectedNodes(dx: number, dy: number): void {
    this.canvas.nodeEdit.nudge(dx, dy);
  }

  public selectAllNodes(): void {
    this.canvas.nodeEdit.selectAll();
  }
  public clearNodeSelection(): void {
    this.canvas.nodeEdit.clearSelection();
  }
  public invertNodeSelection(): void {
    this.canvas.nodeEdit.invertSelection();
  }
  public getSelectedNodeCount(): number {
    return this.canvas.nodeEdit.getSelectedCount();
  }

  public undoNodeEdit(): void {
    this.canvas.nodeEdit.undo();
  }
  public redoNodeEdit(): void {
    this.canvas.nodeEdit.redo();
  }

  /** Получить путь (d) выбранного элемента; для polyline/polygon — points. */
  public getElementPath(id: string): string | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return null;
    const props = (
      el as unknown as { getRenderGeometry: () => Record<string, unknown> }
    ).getRenderGeometry();
    return (props.d as string) ?? (props.points as string) ?? null;
  }

  /** Задать новый путь (d) элементу-пути. */
  public setElementPath(id: string, d: string): void {
    const el = this.canvas.shapeManager.getById(id);
    if (el && el instanceof PathElementCtor) {
      (el as PathElement).d = d;
    }
  }

  // ── Редактирование пути (совместимость) ──

  /** Текущий редактируемый PathElement (совместимость). */
  public get editingPath(): PathElement | null {
    const ids = this.canvas.nodeEdit.session.getTargetIds();
    for (const id of ids) {
      const el = this.canvas.shapeManager.getById(id);
      if (el instanceof PathElementCtor) return el as PathElement;
    }
    return null;
  }

  public set editingPath(path: PathElement | null) {
    if (path) this.canvas.nodeEdit.enter([path]);
    else this.canvas.nodeEdit.exit();
  }

  // ── Измерения (линейка / транспортир) ──

  /** Включить инструмент «Линейка» (замер расстояний в мм). */
  public activateRuler(): void {
    this.canvas.measure.activate('ruler');
  }

  /** Включить инструмент «Транспортир» (замер углов). */
  public activateProtractor(mode: ProtractorMode = 'points'): void {
    this.canvas.measure.setProtractorMode(mode);
    this.canvas.measure.activate('protractor');
  }

  /** Режим транспортира: 'points' (3 точки) или 'objects' (между объектами). */
  public setProtractorMode(mode: ProtractorMode): void {
    this.canvas.measure.setProtractorMode(mode);
  }

  /** Выключить инструмент измерения. */
  public deactivateMeasureTool(): void {
    this.canvas.measure.deactivate();
  }

  /** Текущий активный инструмент измерения. */
  public getMeasureTool(): MeasureTool | null {
    return this.canvas.measure.tool;
  }

  /** Отменить незавершённый замер. */
  public cancelMeasure(): void {
    this.canvas.measure.cancelPending();
  }

  /** Удалить все замеры с холста. */
  public clearMeasurements(): void {
    this.canvas.measure.clearAll();
  }

  /** Удалить один замер по id. */
  public removeMeasurement(id: string): void {
    this.canvas.measure.removeMeasurement(id);
  }

  /** Получить результаты всех замеров (расстояния в мм, углы в градусах). */
  public getMeasurements(): MeasureResult[] {
    return this.canvas.measure.getResults();
  }

  // ── Лазерные группы ──

  public createLaserGroup(dto?: LaserGroupCreateDTO): string {
    const withDpi: LaserGroupCreateDTO = {
      rasterDpi: this.canvas.laserSettings.recommendedDpi,
      ...dto,
    };
    return this.canvas.laserGroupManager.createGroup(withDpi);
  }
  public deleteLaserGroup(id: string): void {
    this.canvas.laserGroupManager.deleteGroup(id);
  }
  public laserGroupAddElements(id: string, elementIds: string[]): void {
    for (const eid of elementIds)
      this.canvas.laserGroupManager.addToGroup(id, eid);
  }
  public laserGroupRemoveElements(id: string, elementIds: string[]): void {
    for (const eid of elementIds)
      this.canvas.laserGroupManager.removeFromGroup(id, eid);
  }
  public clearLaserGroup(id: string): void {
    this.canvas.laserGroupManager.clearGroup(id);
  }
  public updateLaserGroup(id: string, fields: LaserGroupFields): void {
    this.canvas.laserGroupManager.updateGroup(id, fields);
  }
  public setLaserGroupType(id: string, type: LaserOpType): void {
    this.canvas.laserGroupManager.updateGroup(id, { type });
  }
  public setLaserGroupSelectable(id: string, selectable: boolean): void {
    this.canvas.laserGroupManager.updateGroup(id, { selectable });
  }
  public setLaserGroupMovable(id: string, movable: boolean): void {
    this.canvas.laserGroupManager.updateGroup(id, { movable });
  }
  public setLaserGroupVisible(id: string, visible: boolean): void {
    this.canvas.laserGroupManager.updateGroup(id, { visible });
  }
  public getLaserGroups(): LaserGroupData[] {
    return this.canvas.laserGroupManager.getGroups().map((g) => g.toData());
  }
  public getLaserGroup(id: string): LaserGroupData | null {
    return this.canvas.laserGroupManager.getGroup(id)?.toData() ?? null;
  }
  public getLaserGroupByElement(elementId: string): LaserGroupData | null {
    return (
      this.canvas.laserGroupManager.getGroupByElement(elementId)?.toData() ??
      null
    );
  }
  public getElementIdsInLaserGroup(id: string): string[] {
    return this.canvas.laserGroupManager.getElementIdsInGroup(id);
  }

  public loadLaserGroups(data: LaserGroupData[]): void {
    this.canvas.laserGroupManager.loadGroups(data);
  }
  public addLaserGroups(data: LaserGroupData[]): void {
    this.canvas.laserGroupManager.addGroups(data);
  }
  public replaceLaserGroups(data: LaserGroupData[]): void {
    this.canvas.laserGroupManager.replaceGroups(data);
  }
  public updateLaserGroups(
    patches: Array<{ id: string; fields: Record<string, unknown> }>,
  ): void {
    this.canvas.laserGroupManager.updateGroups(patches);
  }
  public getUnsavedLaserGroupDTOs(): Array<Record<string, unknown>> {
    return this.canvas.laserGroupManager.getUnsavedDTOs();
  }

  // ── Настройки лазера ──

  public setLaserLensFocal(mm: number): void {
    this.canvas.laserSettings.lensFocalMm = mm;
    this._emitLaserSettings();
  }
  public setLaserLensDiameter(mm: number): void {
    this.canvas.laserSettings.lensDiameterMm = mm;
    this._emitLaserSettings();
  }
  public setLaserBeamDiameter(mm: number): void {
    this.canvas.laserSettings.beamDiameterMm = mm;
    this._emitLaserSettings();
  }
  public setLaserMaterialHeight(mm: number): void {
    this.canvas.laserSettings.materialHeightMm = mm;
    this._emitLaserSettings();
  }
  public setLaserEngraveColor(hex: string): void {
    this.canvas.laserSettings.engraveColor = hex;
    this.canvas._refreshLaser();
    this._emitLaserSettings();
  }
  public setLaserCutColor(hex: string): void {
    this.canvas.laserSettings.cutColor = hex;
    this.canvas._refreshLaser();
    this._emitLaserSettings();
  }
  public getLaserSpotSize(): number {
    return this.canvas.laserSettings.spotSizeMm;
  }
  public getLaserRecommendedDpi(): number {
    return this.canvas.laserSettings.recommendedDpi;
  }
  public getLaserSettings(): LaserSettingsInfo {
    return this.canvas.laserSettings.toInfo();
  }

  /** Скрыть/показать элементы, не входящие в лазерные группы. */
  public setNonLaserElementsVisible(visible: boolean): void {
    this.canvas.laserSettings.nonLaserHidden = !visible;
    this.canvas.view.refreshLaserStyles();
    this.canvas.events.emit('LASER_VISIBILITY_CHANGED', {
      nonLaserHidden: this.canvas.laserSettings.nonLaserHidden,
      laserTranslucent: this.canvas.laserSettings.laserTranslucent,
    });
  }

  /** Сделать элементы лазерных групп полупрозрачными. */
  public setLaserElementsTranslucent(translucent: boolean): void {
    this.canvas.laserSettings.laserTranslucent = translucent;
    this.canvas.view.refreshLaserStyles();
    this.canvas.events.emit('LASER_VISIBILITY_CHANGED', {
      nonLaserHidden: this.canvas.laserSettings.nonLaserHidden,
      laserTranslucent: translucent,
    });
  }

  public getLaserColorGrading(): Record<string, string> {
    return this.canvas.laserColorResolver.getGrading();
  }

  public getLaserGroupState(): {
    groups: LaserGroupData[];
    settings: LaserSettingsInfo;
    grading: Record<string, string>;
  } {
    return {
      groups: this.getLaserGroups(),
      settings: this.getLaserSettings(),
      grading: this.getLaserColorGrading(),
    };
  }

  private _emitLaserSettings(): void {
    this.canvas.events.emit(
      'LASER_SETTINGS_CHANGED',
      this.canvas.laserSettings.toInfo(),
    );
  }

  // ── Режимы канваса ──

  public setMode(mode: 'edit' | 'layers'): void {
    this.canvas.setMode(mode);
  }

  public getMode(): 'edit' | 'layers' {
    return this.canvas.mode;
  }

  /** Проверка: в режиме слоёв мутирующие API-методы недоступны. Возвращает true если разрешено. */
  private _guardEditMode(): boolean {
    return this.canvas.mode !== 'layers';
  }

  // ── Управление слоями ──

  public createLaserLayer(name?: string): string {
    return this.canvas.laserLayerManager.createLayer(
      name ? { name } : undefined,
    );
  }

  public deleteLaserLayer(id: string): void {
    this.canvas.laserLayerManager.deleteLayer(id);
  }

  public addGroupToLayer(layerId: string, groupId: string): void {
    this.canvas.laserLayerManager.addGroupToLayer(layerId, groupId);
  }

  public removeGroupFromLayer(layerId: string, groupId: string): void {
    this.canvas.laserLayerManager.removeGroupFromLayer(layerId, groupId);
  }

  public setLayerVisibility(layerId: string, visible: boolean): void {
    this.canvas.laserLayerManager.setLayerVisibility(layerId, visible);
    if (this.canvas.mode === 'layers') {
      this.canvas._rebuildLayerOverlay();
    }
  }

  public getLaserLayers(): LaserLayerData[] {
    return this.canvas.laserLayerManager.getLayerData();
  }

  public loadLaserLayers(data: LaserLayerData[]): void {
    this.canvas.laserLayerManager.loadLayers(data);
  }

  /** Показать/скрыть группы без слоя в режиме layers. */
  public setOrphanGroupsVisible(visible: boolean): void {
    this.canvas.orphanGroupsVisible = visible;
    if (this.canvas.mode === 'layers') {
      this.canvas._rebuildLayerOverlay();
    }
  }

  public getOrphanGroupsVisible(): boolean {
    return this.canvas.orphanGroupsVisible;
  }

  /** Изменить порядок слоя. */
  public reorderLayer(layerId: string, newIndex: number): void {
    const layers = this.canvas.laserLayerManager.getLayers();
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    layers.splice(
      Math.max(0, Math.min(newIndex, layers.length - 1)),
      0,
      ...layers.splice(idx, 1),
    );
    this.canvas.laserLayerManager.loadLayers(layers.map((l) => l.toData()));
    if (this.canvas.mode === 'layers') {
      this.canvas._rebuildLayerOverlay();
    }
  }

  // ── Текст / шрифты ──

  /** Инициализировать каталог шрифтов (Google Fonts) по apiKey. */
  public async initTextFonts(apiKey: string): Promise<void> {
    await this.canvas.textController.fonts.init(apiKey);
    this.canvas.events.emit('FONTS_READY', {});
  }

  /** Поиск шрифтов по подстроке/категории. */
  public searchFonts(
    query = '',
    category?: string,
  ): ReturnType<TextControllerType['fonts']['search']> {
    return this.canvas.textController.fonts.search(query, category);
  }

  /** Метаданные вариантов шрифта (веса, наличие italic). */
  public getFontVariants(
    family: string,
  ): ReturnType<TextControllerType['fonts']['getVariants']> {
    return this.canvas.textController.fonts.getVariants(family);
  }

  /** Активировать инструмент «Текст». */
  public activateTextTool(): void {
    this.setActiveCreationTool('text');
  }

  /** Войти в режим редактирования текста. */
  public enterTextEdit(id: string): void {
    this.canvas.textController.enterEdit(id);
  }
  /** Выйти из режима редактирования текста (применить). */
  public exitTextEdit(): void {
    this.canvas.textController.exitEdit();
  }
  public isTextEditing(): boolean {
    return this.canvas.textController.isEditing;
  }

  /**
   * Применить стиль. В режиме правки — к выделенному диапазону;
   * в режиме селекта — ко всем выбранным текстовым элементам.
   */
  public async setTextStyle(patch: TextStylePatch): Promise<void> {
    await this.canvas.textController.applyStyle(patch);
  }
  public setTextFontSize(px: number): void {
    void this.canvas.textController.applyStyle({ fontSizePx: px });
  }
  public setTextFontFamily(family: string): void {
    void this.canvas.textController.applyStyle({ fontFamily: family });
  }
  public setTextWeight(weight: string): void {
    void this.canvas.textController.applyStyle({ fontWeight: weight });
  }
  public setTextItalic(italic: boolean): void {
    void this.canvas.textController.applyStyle({ italic });
  }
  public setTextColor(color: string): void {
    void this.canvas.textController.applyStyle({ color });
  }
  public setTextUnderline(on: boolean): void {
    void this.canvas.textController.applyStyle({ underline: on });
  }
  public setTextStrike(on: boolean): void {
    void this.canvas.textController.applyStyle({ strike: on });
  }
  public setTextAlign(align: 'left' | 'center' | 'right'): void {
    void this.canvas.textController.applyStyle({ align });
  }

  public getText(id: string): string | null {
    return this.canvas.textController.getContent(id);
  }
  public setText(id: string, html: string): void {
    this.canvas.textController.setContent(id, html);
  }

  public deleteTextCharacter(direction: 'forward' | 'backward'): void {
    this.canvas.textController.deleteCharacter(direction);
  }
  public undoTextEdit(): void {
    this.canvas.textController.undo();
  }
  public redoTextEdit(): void {
    this.canvas.textController.redo();
  }

  // ── Камера / пан ──

  /** Принудительный пан камеры (пробел зажат). */
  public setPanHeld(held: boolean): void {
    this.canvas.camera.panHeld = held;
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
      'text',
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

  /** Перевернуть ось Y линейки: 0 внизу артборда */
  public setRulerFlipY(flip: boolean): void {
    const hPx = this.canvas.artboard.heightPx;
    this.canvas.rulers.setFlipY(flip, hPx);
  }
  public getRulerFlipY(): boolean {
    return this.canvas.rulers.flipY;
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

  // ── Копирование и Use-элементы ──

  private _generateId(): string {
    return crypto.randomUUID?.() ?? `shape_${Date.now()}_${++_idCounter}`;
  }

  /** Найти корневой элемент по ID, обходя цепочку use-элементов */
  private _resolveRootElement(id: string): AbstractGraphicElement | undefined {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return undefined;
    if (el instanceof UseElement && el._parentElement) {
      return this._resolveRootElement(el._parentElement.id);
    }
    return el;
  }

  /** Глубокое копирование выбранных элементов.
   *  Копии смещаются на dx, dy. Выделение переводится на копии. */
  public duplicateSelected(dx = 50, dy = 50): AbstractGraphicElement[] {
    if (!this._guardEditMode()) return [];
    const selected = this.getSelected();
    if (selected.length === 0) return [];

    const clones: AbstractGraphicElement[] = [];

    for (const original of selected) {
      const resolved =
        original instanceof UseElement && original._parentElement
          ? this._resolveRootElement(original.id)!
          : original;

      const clone = resolved.clone();
      clone.id = this._generateId();
      clone.name = resolved.name;

      clone.transform.matrix.e += dx;
      clone.transform.matrix.f += dy;

      clone.setVisible(resolved.visible);
      clone.lock = resolved.lock;
      clone.rebuildHitArea();
      clone.clearTimeMachineDiff();

      this.canvas.elementManager.addShape(clone);
      clones.push(clone);
    }

    this.canvas.selectionState.replace(clones);
    this.canvas.selectionManager.setElementSelection(
      clones.map((c) => c.id),
      (id) => this.canvas.shapeManager.getById(id),
    );

    this.canvas.timeMachine.push(
      'CREATE',
      clones.map((c) => c.id),
      'element',
      [],
      clones,
    );

    return clones;
  }

  /** Создать use-элементы из выбранных.
   *  Use-элементы ссылаются на оригиналы, смещены на dx, dy, прозрачность 25%.
   *  Если выбран use-элемент — ссылка идёт на корневой оригинал. */
  public useDuplicateSelected(dx = 50, dy = 50): UseElement[] {
    if (!this._guardEditMode()) return [];
    const selected = this.getSelected();
    if (selected.length === 0) return [];

    const useElements: UseElement[] = [];

    for (const original of selected) {
      const root = this._resolveRootElement(original.id);
      if (!root) continue;

      const useEl = new UseElement(this._generateId());
      useEl.style.opacity = 0.25;
      useEl.transform.matrix = new DOMMatrix().translateSelf(dx, dy);
      useEl.bindToParent(root);
      useEl.clearTimeMachineDiff();

      this.canvas.elementManager.addShape(useEl);
      useElements.push(useEl);
    }

    this.canvas.selectionState.replace(useElements);
    this.canvas.selectionManager.setElementSelection(
      useElements.map((u) => u.id),
      (id) => this.canvas.shapeManager.getById(id),
    );

    this.canvas.timeMachine.push(
      'CREATE',
      useElements.map((u) => u.id),
      'element',
      [],
      useElements,
    );

    return useElements;
  }

  /** Отвязать use-элемент от родителя: заменить глубокой копией с текущим положением. */
  public unbindUseElement(useId: string): AbstractGraphicElement | null {
    if (!this._guardEditMode()) return null;
    const el = this.canvas.shapeManager.getById(useId);
    if (!el || !(el instanceof UseElement)) return null;

    const clone = el.unobind();
    if (!clone) return null;

    this.canvas.elementManager.deleteElements([useId]);
    this.canvas.elementManager.addShape(clone);

    this.canvas.selectionState.replace([clone]);
    this.canvas.selectionManager.setElementSelection([clone.id], (id) =>
      this.canvas.shapeManager.getById(id),
    );

    this.canvas.timeMachine.push(
      'CREATE',
      [clone.id],
      'element',
      [el.id],
      [clone],
    );

    return clone;
  }

  /** Установить прозрачность use-элемента.
   *  @param opacity 0 — скрыт, 0.25 — затемнён (по умолчанию), 1 — полностью видим */
  public setUseOpacity(useId: string, opacity: 0 | 0.25 | 1): void {
    const el = this.canvas.shapeManager.getById(useId);
    if (!el || !(el instanceof UseElement)) return;
    el.setDiff({ 'style.opacity': opacity } as Record<string, number | string>);
    const raw = el as unknown as Record<string, unknown>;
    raw._diffRendering = {
      ...((raw._diffRendering as Record<string, unknown>) || {}),
      'style.opacity': opacity,
    };
    el.pushDiffRendering?.(el);
  }

  /** Проверить, является ли элемент use-элементом */
  public isUseElement(id: string): boolean {
    const el = this.canvas.shapeManager.getById(id);
    return el instanceof UseElement;
  }

  /** Получить ID родительского элемента use-элемента */
  public getUseParentId(id: string): string | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el || !(el instanceof UseElement)) return null;
    return el.refId || null;
  }

  /** Найти все use-элементы, ссылающиеся на заданный родительский элемент */
  public getUseChildIds(parentId: string): string[] {
    const all = this.canvas.shapeManager.getAll();
    return all
      .filter((el) => el instanceof UseElement && el.refId === parentId)
      .map((el) => el.id);
  }

  /** Отвязать все use-элементы, ссылающиеся на заданный элемент.
   *  При выборе родителя — делает все его use-копии самостоятельными. */
  public unbindAllUseReferences(parentId: string): AbstractGraphicElement[] {
    if (!this._guardEditMode()) return [];
    const useIds = this.getUseChildIds(parentId);
    if (useIds.length === 0) return [];

    const clones: AbstractGraphicElement[] = [];

    for (const useId of useIds) {
      const clone = this.unbindUseElement(useId);
      if (clone) clones.push(clone);
    }

    if (clones.length > 0) {
      this.canvas.selectionState.replace(clones);
      this.canvas.selectionManager.setElementSelection(
        clones.map((c) => c.id),
        (id) => this.canvas.shapeManager.getById(id),
      );
    }

    return clones;
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
    const round = (v: number): string => String(Math.round(v));
    switch (type) {
      case 'rect': {
        const r = geo as RectGeometryDTO;
        attrs.x = round(r.x);
        attrs.y = round(r.y);
        attrs.width = round(r.width);
        attrs.height = round(r.height);
        if (r.rx !== undefined) attrs.rx = round(r.rx);
        if (r.ry !== undefined) attrs.ry = round(r.ry);
        break;
      }
      case 'circle': {
        const c = geo as CircleGeometryDTO;
        attrs.cx = round(c.cx);
        attrs.cy = round(c.cy);
        attrs.r = round(c.r);
        break;
      }
      case 'ellipse': {
        const e = geo as EllipseGeometryDTO;
        attrs.cx = round(e.cx);
        attrs.cy = round(e.cy);
        attrs.rx = round(e.rx);
        attrs.ry = round(e.ry);
        break;
      }
      case 'line': {
        const l = geo as LineGeometryDTO;
        attrs.x1 = round(l.x1);
        attrs.y1 = round(l.y1);
        attrs.x2 = round(l.x2);
        attrs.y2 = round(l.y2);
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
        attrs.x = round(img.x);
        attrs.y = round(img.y);
        attrs.width = round(img.width);
        attrs.height = round(img.height);
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
    const colorLocked =
      this.canvas.laserGroupManager.getGroupByElement(el.id) !== undefined;
    if (style.fill !== undefined && !colorLocked) el.style.fill = style.fill;
    if (style.stroke !== undefined && !colorLocked)
      el.style.stroke = style.stroke;
    if (
      (style.fill !== undefined || style.stroke !== undefined) &&
      colorLocked
    ) {
      this.canvas.events.emit('LASER_STYLE_LOCKED', { id: el.id });
    }
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

  // ── Гибкое дерево (flex tree / living hinge) ──

  private ensureFlexTree(id: string): FlexTree | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return null;
    if (!el.flexTree) el.flexTree = new FlexTree();
    return el.flexTree;
  }

  public setFlexTreeAlgorithm(id: string, algorithm: FlexTreeAlgorithm): void {
    const ft = this.ensureFlexTree(id);
    if (!ft) return;
    ft.algorithm = algorithm;
    this.canvas.events.emit('FLEX_TREE_CHANGED', { id, algorithm });
  }

  public setFlexTreeParams(
    id: string,
    params: Partial<{
      step: number;
      link: number;
      dash: number;
      amplitude: number;
    }>,
  ): void {
    const ft = this.ensureFlexTree(id);
    if (!ft) return;
    if (params.step !== undefined) {
      ft.step = clamp(
        params.step,
        FLEX_VALIDATION.step.min,
        FLEX_VALIDATION.step.max,
      );
    }
    if (params.link !== undefined) {
      ft.link = clamp(
        params.link,
        FLEX_VALIDATION.link.min,
        FLEX_VALIDATION.link.max,
      );
    }
    if (params.dash !== undefined) {
      ft.dash = clamp(
        params.dash,
        FLEX_VALIDATION.dash.min,
        FLEX_VALIDATION.dash.max,
      );
    }
    if (params.amplitude !== undefined) {
      const maxA = ft.step / 2 - 0.5;
      ft.amplitude = clamp(params.amplitude, 0, Math.max(0, maxA));
    }
    this.canvas.events.emit('FLEX_TREE_CHANGED', {
      id,
      step: ft.step,
      link: ft.link,
      dash: ft.dash,
      amplitude: ft.amplitude,
    });
  }

  public applyFlexTreePreset(
    id: string,
    preset: 'thin' | 'standard' | 'thick',
  ): void {
    const ft = this.ensureFlexTree(id);
    if (!ft) return;
    const p = FLEX_TREE_PRESETS[preset];
    ft.step = p.step;
    ft.link = p.link;
    ft.dash = p.dash;
    ft.amplitude = p.amplitude;
    this.canvas.events.emit('FLEX_TREE_CHANGED', { id, preset });
  }

  public getFlexTreeConfig(id: string): {
    algorithm: FlexTreeAlgorithm;
    step: number;
    link: number;
    dash: number;
    amplitude: number;
  } | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el || !el.flexTree) return null;
    const ft = el.flexTree;
    return {
      algorithm: ft.algorithm,
      step: ft.step,
      link: ft.link,
      dash: ft.dash,
      amplitude: ft.amplitude,
    };
  }

  public removeFlexTree(id: string): void {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return;
    el.flexTree = undefined;
    this.canvas.events.emit('FLEX_TREE_REMOVED', { id });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
