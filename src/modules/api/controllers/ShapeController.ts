import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { createFromJSON } from '@/core/shapes/factory';
import type { BooleanOp, ElementType } from '@/core/type';
import {
  createCreateCommand,
  createCreateFileCommand,
  createDragMoveCommand,
  createResizeCommand,
  createRotateCommand,
  createTransformCommand,
} from '@/core/commands';
import { MM_TO_PX } from '@/constants';
import { guardEditMode } from './helpers';
import type {
  CreateShapeDTO,
  UpdateShapesDTO,
  DeleteShapesDTO,
  MoveShapesDTO,
  RotateShapesDTO,
  ResizeShapesDTO,
  SetTransformShapesDTO,
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
} from '../dto-types';

let _idCounter = 0;
const generateId = (): string =>
  crypto.randomUUID?.() ?? `shape_${Date.now()}_${++_idCounter}`;

export class ShapeController {
  constructor(private canvas: SvgCanvas) {}

  createShape(dto: CreateShapeDTO): AbstractGraphicElement {
    if (!guardEditMode(this.canvas))
      return null as unknown as AbstractGraphicElement;
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

  createFile(
    dtos: CreateShapeDTO[],
    name?: string,
  ): { groupId: string; elements: AbstractGraphicElement[] } {
    const elements: AbstractGraphicElement[] = [];
    const groupId = `file_${Date.now()}_${++_idCounter}`;
    const groupName = name ?? `file_${_idCounter}`;
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

  deleteShapes(dto: DeleteShapesDTO): void {
    if (!guardEditMode(this.canvas)) return;
    this._purgeLaser(dto.elementIds);
    this.canvas.elementManager.deleteElements(dto.elementIds);
  }

  deleteElement(id: string): void {
    this._purgeLaser([id]);
    this.canvas.elementManager.deleteElements([id]);
  }

  deleteElements(ids: string[]): void {
    this._purgeLaser(ids);
    this.canvas.elementManager.deleteElements(ids);
  }

  updateShapes(dto: UpdateShapesDTO): void {
    if (!guardEditMode(this.canvas)) return;
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

  moveShapes(dto: MoveShapesDTO): void {
    if (!guardEditMode(this.canvas)) return;
    this.canvas.commandBus.execute(
      createDragMoveCommand('element', dto.delta, dto.elementIds),
    );
  }

  rotateShapes(dto: RotateShapesDTO): void {
    if (!guardEditMode(this.canvas)) return;
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createRotateCommand(dto.elementIds, dto.angle),
    );
  }

  resizeShapes(dto: ResizeShapesDTO): void {
    if (!guardEditMode(this.canvas)) return;
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createResizeCommand(dto.elementIds, dto.bbox),
    );
  }

  setTransformShapes(dto: SetTransformShapesDTO): void {
    if (!guardEditMode(this.canvas)) return;
    if (!dto.elementIds?.length) return;
    this.canvas.commandBus.execute(
      createTransformCommand(dto.elementIds, dto.matrix),
    );
  }

  resizeElement(id: string, widthMm: number, heightMm: number): void {
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

  rotateElement(id: string, angle: number): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.rotate(angle, el.getLocalCenter());
    el.rebuildHitArea();
    this._emitSize(id);
  }

  transformElement(
    id: string,
    matrix: [number, number, number, number, number, number],
  ): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    el.transform.matrix = new DOMMatrix(matrix);
    el.rebuildHitArea();
  }

  getAllShapes(): readonly AbstractGraphicElement[] {
    return this.canvas.shapeManager.getAll();
  }

  getElementById(id: string): Record<string, unknown> | null {
    const el = this.canvas.shapeManager.getById(id) as
      | AbstractGraphicElement
      | undefined;
    if (!el) return null;
    return el.toDTO();
  }

  sortShapes(_dto: SortShapesDTO): void {
    // TODO: implement layer reordering
  }

  reorderElement(
    _id: string,
    _position: 'before' | 'after',
    _targetId: string,
  ): void {
    // TODO: implement layer reordering
  }

  outlineElement(id: string): void {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return;
    const outline = el.toOutlinePath();
    this.canvas.hitTestEngine.remove(el.id);
    this.canvas.shapeManager.removeElementAndNode(el.id);
    this.canvas.shapeManager.addElement(outline);
    this.addShape(outline);
    this.canvas.events.emit('element-outlined', { id, newId: outline.id });
  }

  getOutlinePath(id: string): Record<string, unknown> | null {
    const el = this.canvas.shapeManager.getAll().find((e) => e.id === id);
    if (!el) return null;
    const path = el.toOutlinePath();
    return path.toDTO();
  }

  addShape(shape: AbstractGraphicElement): void {
    this.canvas.elementManager.addShape(shape);
    shape.clearTimeMachineDiff();
  }

  enterBooleanMode(op: BooleanOp): void {
    this.canvas.booleanHandler.enterMode(op);
  }

  exitBooleanMode(): void {
    this.canvas.booleanHandler.exitMode();
  }

  indexShape(shape: AbstractGraphicElement): void {
    this.canvas.elementManager.indexShape(shape);
  }

  reindexElement(el: AbstractGraphicElement): void {
    this.canvas.elementManager.reindexElement(el);
  }

  reindexSpatialGrid(): void {
    this.canvas.elementManager.reindexAll();
  }

  private _purgeLaser(ids: string[]): void {
    for (const id of ids) this.canvas.laserGroupManager.purgeElement(id);
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
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

  private _refreshSelectionOverlay(): void {
    this.canvas.selectionManager.syncElementPositions((id) =>
      this.canvas.shapeManager.getAll().find((e) => e.id === id),
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
}
