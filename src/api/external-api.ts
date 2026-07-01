import type { SvgCanvas } from '@/core/SvgCanvas';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { BusEvent } from '@/core/EventBus';
import type { GuidelineData } from '@/ruler';
import type { BooleanOp } from '@/boolean';
import type { Group } from '@/group';
import { createFromJSON } from '@/shapes/elements/factory';
import { DebugLog } from '@/utils/DebugLog';
import {
  createCreateCommand,
  createCreateFileCommand,
  createDragMoveCommand,
  createResizeCommand,
  createRotateCommand,
  createTransformCommand,
} from '@/commands';
import type { ElementType } from '@/types';
import { MM_TO_PX } from '@/constants';
import { getRenderQueue } from '@/utils/render-queue-utils';
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

  public setDebugMode(enabled: boolean): void {
    this.dbg.setEnabled(enabled);
  }

  public on(type: string, fn: (event: BusEvent) => void): () => void {
    this.dbg.log('API', `on ${type}`);
    return this.canvas.events.on(type, fn);
  }

  public off(type: string, fn: (event: BusEvent) => void): void {
    this.dbg.log('API', `off ${type}`);
    this.canvas.events.off(type, fn);
  }

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

    this.canvas.getCommandBus().execute(createCreateCommand(el));
    return el;
  }

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

    this.canvas
      .getCommandBus()
      .execute(createCreateFileCommand(elements, groupId, groupName));

    return { groupId, elements };
  }

  public deleteShapes(dto: DeleteShapesDTO): void {
    this.dbg.log('API', 'deleteShapes', { count: dto.elementIds.length });
    this.canvas.deleteElements(dto.elementIds);
  }

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

  public moveShapes(dto: MoveShapesDTO): void {
    this.dbg.log('API', 'moveShapes', {
      count: dto.elementIds.length,
      delta: dto.delta,
    });
    this.canvas
      .getCommandBus()
      .execute(createDragMoveCommand('element', dto.delta, dto.elementIds));
  }

  public rotateShapes(dto: RotateShapesDTO): void {
    this.dbg.log('API', 'rotateShapes', {
      count: dto.elementIds.length,
      angle: dto.angle,
    });
    if (!dto.elementIds?.length) return;
    this.canvas
      .getCommandBus()
      .execute(createRotateCommand(dto.elementIds, dto.angle));
  }

  public resizeShapes(dto: ResizeShapesDTO): void {
    this.dbg.log('API', 'resizeShapes', { count: dto.elementIds.length });
    if (!dto.elementIds?.length) return;
    this.canvas
      .getCommandBus()
      .execute(createResizeCommand(dto.elementIds, dto.bbox));
  }

  public setTransformShapes(dto: SetTransformShapesDTO): void {
    this.dbg.log('API', 'setTransformShapes', { count: dto.elementIds.length });
    if (!dto.elementIds?.length) return;
    this.canvas
      .getCommandBus()
      .execute(createTransformCommand(dto.elementIds, dto.matrix));
  }

  public groupCreate(dto: GroupCreateDTO): string {
    this.dbg.log('API', 'groupCreate', { name: dto.name });
    return this.canvas.createGroup(dto.name);
  }

  public groupDelete(dto: GroupDeleteDTO): void {
    this.dbg.log('API', 'groupDelete', { groupId: dto.groupId });
    this.canvas.deleteGroup(dto.groupId);
  }

  public groupAddElements(dto: GroupAddElementsDTO): void {
    this.dbg.log('API', 'groupAddElements', {
      groupId: dto.groupId,
      count: dto.elementIds.length,
    });
    this.canvas.addToGroup(dto.groupId, dto.elementIds as unknown as string);
  }

  public groupRemoveElements(dto: GroupRemoveElementsDTO): void {
    this.dbg.log('API', 'groupRemoveElements', {
      groupId: dto.groupId,
      count: dto.elementIds.length,
    });
    this.canvas.removeFromGroup(
      dto.groupId,
      dto.elementIds as unknown as string,
    );
  }

  public getGroups(): Group[] {
    this.dbg.log('API', 'getGroups');
    return this.canvas.groups;
  }

  public selectGroup(id: string): void {
    this.dbg.log('API', 'selectGroup', { id });
    this.canvas.selectGroup(id);
  }

  public selectGroupElements(id: string): void {
    this.dbg.log('API', 'selectGroupElements', { id });
    this.canvas.selectGroupElements(id);
  }

  public getElementIdsInGroup(id: string): string[] {
    this.dbg.log('API', 'getElementIdsInGroup', { id });
    return this.canvas.getElementIdsInGroup(id);
  }

  public selectShapes(dto: SelectShapesDTO): void {
    this.dbg.log('API', 'selectShapes', {
      count: dto.elementIds.length,
      toggle: dto.toggle,
    });
    const elements = this.findElements(dto.elementIds);
    if (dto.toggle) {
      const current = [...this.canvas.getSelected()];
      for (const el of elements) {
        const idx = current.findIndex((s) => s.id === el.id);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(el);
        }
      }
      this.canvas.setSelectedElements(current);
    } else {
      this.canvas.setSelectedElements(elements);
    }
  }

  public clearSelection(): void {
    this.dbg.log('API', 'clearSelection');
    this.canvas.setSelectedElements([]);
  }

  public getAllShapes(): readonly AbstractGraphicElement[] {
    this.dbg.log('API', 'getAllShapes');
    return this.canvas.shapeManager.getAll();
  }

  public sortShapes(dto: SortShapesDTO): void {
    this.dbg.log('API', 'sortShapes', {
      count: dto.elementIds.length,
      position: dto.position,
    });
    if (!dto.elementIds?.length) return;
    for (const id of dto.elementIds) {
      this.canvas.reorderElement(id, dto.position, dto.targetId);
    }
  }

  public getCanvasSize(): {
    widthMM: number;
    heightMM: number;
    widthPx: number;
    heightPx: number;
    pxPerMM: number;
  } {
    this.dbg.log('API', 'getCanvasSize');
    const artboard = this.canvas.getArtboard();
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

  public setPanMode(enabled: boolean): void {
    this.dbg.log('API', 'setPanMode', { enabled });
    this.canvas.panActive.value = enabled;
    if (enabled) {
      this.canvas.setActiveCreationTool(null);
    }
    this.canvas.events.emit('SVG_CAD_PAN_MODE_CHANGED', { enabled });
  }

  public setSnapToCorners(enabled: boolean): void {
    this.dbg.log('API', 'setSnapToCorners', { enabled });
    this.canvas.setSnapToCorners(enabled);
  }

  public setSnapToPlanes(enabled: boolean): void {
    this.dbg.log('API', 'setSnapToPlanes', { enabled });
    this.canvas.setSnapToPlanes(enabled);
  }

  public setSnapToArtboard(enabled: boolean): void {
    this.dbg.log('API', 'setSnapToArtboard', { enabled });
    this.canvas.setSnapToArtboard(enabled);
  }

  public setAvoidCollisions(enabled: boolean): void {
    this.canvas.setAvoidCollisions(enabled);
  }

  public setSnapToGuidelines(enabled: boolean): void {
    this.canvas.setSnapToGuidelines(enabled);
  }

  public setSnapToGrid(enabled: boolean): void {
    this.canvas.setSnapToGrid(enabled);
  }

  public setSnapAxis(mode: 'both' | 'horizontal' | 'vertical'): void {
    this.canvas.setSnapAxis(mode);
  }

  public outlineElement(id: string): void {
    this.canvas.outlineElement(id);
  }

  public getOutlinePath(id: string): Record<string, unknown> | null {
    const path = this.canvas.getOutlinePath(id);
    if (!path) return null;
    return path.toDTO();
  }

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
      this.canvas.setActiveCreationTool(type as any);
    }
  }

  public setTransformMode(mode: 'resize' | 'rotate'): void {
    this.canvas.setTransformMode(mode);
  }

  public setProportionalResize(enabled: boolean): void {
    this.canvas.setProportionalResize(enabled);
  }

  public setRulersVisible(v: boolean): void {
    this.dbg.log('API', 'setRulersVisible', { v });
    this.canvas.setRulersVisible(v);
  }

  public getRulersVisible(): boolean {
    this.dbg.log('API', 'getRulersVisible');
    return this.canvas.getRulersVisible();
  }

  public addGuideline(orientation: 'v' | 'h', position: number): string {
    this.dbg.log('API', 'addGuideline', { orientation, position });
    return this.canvas.addGuideline(orientation, position);
  }

  public removeGuideline(id: string): void {
    this.dbg.log('API', 'removeGuideline', { id });
    this.canvas.removeGuideline(id);
  }

  public getGuidelines(): GuidelineData[] {
    this.dbg.log('API', 'getGuidelines');
    return this.canvas.getGuidelines();
  }

  public setGuidelinesVisible(orientation: 'v' | 'h', v: boolean): void {
    this.dbg.log('API', 'setGuidelinesVisible', { orientation, v });
    this.canvas.setGuidelinesVisible(orientation, v);
  }

  public getGuidelinesVisible(orientation: 'v' | 'h'): boolean {
    this.dbg.log('API', 'getGuidelinesVisible', { orientation });
    return this.canvas.getGuidelinesVisible(orientation);
  }

  public enterBooleanMode(op: BooleanOp): void {
    this.dbg.log('API', 'enterBooleanMode', { op });
    this.canvas.enterBooleanMode(op);
  }

  public exitBooleanMode(): void {
    this.dbg.log('API', 'exitBooleanMode');
    this.canvas.exitBooleanMode();
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

    const el = createFromJSON({ id, type, attributes: attrs });
    return el;
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
      case 'path': {
        attrs.d = (geo as PathGeometryDTO).d;
        break;
      }
      case 'polygon': {
        attrs.points = (geo as PolygonGeometryDTO).points;
        break;
      }
      case 'polyline': {
        attrs.points = (geo as PolylineGeometryDTO).points;
        break;
      }
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
      getRenderQueue()?.add(el);
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

  public loadElements(dtos: Record<string, unknown>[]): void {
    this.canvas.loadElements(
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
    this.canvas.addElements(
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
    this.canvas.replaceElements(
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
    this.canvas.updateElements(patches);
  }

  public showPreloader(): void {
    this.canvas.showPreloader();
  }

  public hidePreloader(): void {
    this.canvas.hidePreloader();
  }

  public isPreloaderVisible(): boolean {
    return this.canvas.isPreloaderVisible();
  }

  public showGrid(): void {
    this.canvas.showGrid();
  }

  public hideGrid(): void {
    this.canvas.hideGrid();
  }

  public isGridVisible(): boolean {
    return this.canvas.isGridVisible();
  }

  public setGridStep(mm: number): void {
    this.canvas.setGridStep(mm);
  }

  public getGridStep(): number {
    return this.canvas.getGridStep();
  }

  public getUnsavedDTOs(): Array<Record<string, unknown>> {
    return this.canvas.getUnsavedDTOs();
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    this.canvas.setArtboardSize(widthMM, heightMM);
  }

  public loadGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.loadGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  public addGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.addGroups(
      dtos.map((d) => ({
        id: (d.id as string) || generateId(),
        name: (d.name as string) ?? '',
        elementIds: (d.elementIds as string[]) ?? [],
      })),
    );
  }

  public replaceGroups(dtos: Record<string, unknown>[]): void {
    this.canvas.replaceGroups(
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
    this.canvas.updateGroups(patches);
  }

  public getUnsavedGroupDTOs(): Array<Record<string, unknown>> {
    return this.canvas.getUnsavedGroupDTOs();
  }

  public selectElements(ids: string[]): void {
    this.canvas.selectElements(ids);
  }

  public getSelectedStyles(): Array<Record<string, unknown>> {
    return this.canvas.getSelectedStyles();
  }

  public getFillColorMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.canvas.getFillColorMap()) {
      result[key] = Array.from(set);
    }
    return result;
  }

  public getStrokeColorMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.canvas.getStrokeColorMap()) {
      result[key] = Array.from(set);
    }
    return result;
  }

  public recalculateColorMaps(): void {
    this.canvas.recalculateColorMaps();
  }

  public getElementById(id: string): Record<string, unknown> | null {
    this.dbg.log('API', 'getElementById', id);
    const el = this.canvas.shapeManager.getById(id) as
      | AbstractGraphicElement
      | undefined;
    if (!el) return null;
    return el.toDTO();
  }

  public setColorQuantStep(step: number): void {
    this.canvas.setColorQuantStep(step);
  }

  private applyGeometryDelta(
    el: AbstractGraphicElement,
    geo: Partial<ElementGeometryDTO>,
  ): void {
    const snapshot = el.toDTO().attributes as Record<string, unknown>;
    const merged = { ...snapshot, ...geo };
    el.applyDTO(merged);
  }
}
