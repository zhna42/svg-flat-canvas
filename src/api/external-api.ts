import type { SvgCanvas } from '@/core/SvgCanvas';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { BusEvent } from '@/core/EventBus';
import { createFromJSON } from '@/shapes/elements/factory';
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
const generateId = (): string => `shape_${Date.now()}_${++_idCounter}`;

export class ExternalApi {
  private readonly canvas: SvgCanvas;
  private fileCounter = 0;

  public constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  public on(type: string, fn: (event: BusEvent) => void): () => void {
    return this.canvas.events.on(type, fn);
  }

  public off(type: string, fn: (event: BusEvent) => void): void {
    this.canvas.events.off(type, fn);
  }

  public createShape(dto: CreateShapeDTO): AbstractGraphicElement {
    const id = dto.id ?? generateId();
    const el = this.dtoToElement(id, dto.type, dto.geometry, dto.style);

    if (dto.transform) this.applyTransformDto(el, dto.transform);
    if (dto.name !== undefined) el.name = dto.name;
    if (dto.visible !== undefined) el.setVisible(dto.visible);
    if (dto.lock !== undefined) el.setLock(dto.lock);
    if (dto.groupId !== undefined) el.groupId = dto.groupId;
    if (dto.data !== undefined) el.data = { ...dto.data };

    this.canvas.getCommandBus().execute(createCreateCommand(el));
    return el;
  }

  public createFile(dtos: CreateShapeDTO[], name?: string): { groupId: string; elements: AbstractGraphicElement[] } {
    const elements: AbstractGraphicElement[] = [];
    const groupId = `file_${Date.now()}_${++this.fileCounter}`;
    const groupName = name ?? `file_${this.fileCounter}`;

    for (const dto of dtos) {
      const id = dto.id ?? generateId();
      const el = this.dtoToElement(id, dto.type, dto.geometry, dto.style);

      if (dto.transform) this.applyTransformDto(el, dto.transform);
      if (dto.name !== undefined) el.name = dto.name;
      if (dto.visible !== undefined) el.setVisible(dto.visible);
      if (dto.lock !== undefined) el.setLock(dto.lock);
      if (dto.data !== undefined) el.data = { ...dto.data };

      elements.push(el);
    }

    this.canvas
      .getCommandBus()
      .execute(createCreateFileCommand(elements, groupId, groupName));

    return { groupId, elements };
  }

  public deleteShapes(dto: DeleteShapesDTO): void {
    this.canvas.deleteElements(dto.elementIds);
  }

  public updateShapes(dto: UpdateShapesDTO): void {
    const elements = this.findElements(dto.elementIds);
    for (const el of elements) {
      if (dto.style) this.applyStyleDto(el, dto.style);
      if (dto.transform) this.applyTransformDto(el, dto.transform);
      if (dto.geometry) this.applyGeometryDelta(el, dto.geometry);
      if (dto.name !== undefined) el.setName(dto.name);
      if (dto.visible !== undefined) el.setVisible(dto.visible);
      if (dto.lock !== undefined) el.setLock(dto.lock);
      if (dto.groupId !== undefined) el.groupId = dto.groupId;
      if (dto.data !== undefined) el.data = { ...el.data, ...dto.data };
    }
  }

  public moveShapes(dto: MoveShapesDTO): void {
    this.canvas
      .getCommandBus()
      .execute(createDragMoveCommand('element', dto.delta, dto.elementIds));
  }

  public rotateShapes(dto: RotateShapesDTO): void {
    for (const id of dto.elementIds) {
      this.canvas.rotateElement(id, dto.angle);
    }
    this.canvas
      .getCommandBus()
      .execute(createRotateCommand(dto.elementIds, dto.angle));
  }

  public resizeShapes(dto: ResizeShapesDTO): void {
    this.canvas
      .getCommandBus()
      .execute(createResizeCommand(dto.elementIds, dto.bbox));
  }

  public setTransformShapes(dto: SetTransformShapesDTO): void {
    for (const id of dto.elementIds) {
      this.canvas.transformElement(id, dto.matrix);
    }
    this.canvas
      .getCommandBus()
      .execute(createTransformCommand(dto.elementIds, dto.matrix));
  }

  public groupCreate(dto: GroupCreateDTO): string {
    return this.canvas.createGroup(dto.name);
  }

  public groupDelete(dto: GroupDeleteDTO): void {
    this.canvas.deleteGroup(dto.groupId);
  }

  public groupAddElements(dto: GroupAddElementsDTO): void {
    this.canvas.addToGroup(dto.groupId, dto.elementIds as unknown as string);
  }

  public groupRemoveElements(dto: GroupRemoveElementsDTO): void {
    this.canvas.removeFromGroup(
      dto.groupId,
      dto.elementIds as unknown as string,
    );
  }

  public selectShapes(dto: SelectShapesDTO): void {
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
    this.canvas.setSelectedElements([]);
  }

  public getAllShapes(): readonly AbstractGraphicElement[] {
    return this.canvas.getSelected();
  }

  private findElements(ids: string[]): AbstractGraphicElement[] {
    const all = this.canvas.getSelected();
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

    const el = createFromJSON({
      id,
      type,
      attributes: attrs,
    });

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
        const p = geo as PathGeometryDTO;
        attrs.d = p.d;
        break;
      }
      case 'polygon': {
        const p = geo as PolygonGeometryDTO;
        attrs.points = p.points;
        break;
      }
      case 'polyline': {
        const p = geo as PolylineGeometryDTO;
        attrs.points = p.points;
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
      default:
        break;
    }
    return attrs;
  }

  private applyStyleDto(
    el: AbstractGraphicElement,
    style: Partial<StyleDTO>,
  ): void {
    if (style.fill !== undefined) el.setFill(style.fill);
    if (style.stroke !== undefined) el.setStroke(style.stroke);
    if (style.strokeWidth !== undefined) el.setStrokeWidth(style.strokeWidth);
    if (style.opacity !== undefined) el.setOpacity(style.opacity);
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
      el.invalidateHitArea();
      return;
    }
    const { x, y, scaleX, scaleY, angle } = t;
    if (x !== undefined || y !== undefined) {
      const dx = x !== undefined ? x - el.transform.x : 0;
      const dy = y !== undefined ? y - el.transform.y : 0;
      if (dx !== 0 || dy !== 0) el.translate(dx, dy);
    }
    if (scaleX !== undefined || scaleY !== undefined) {
      const center = el.getCenter();
      el.applyTransformation('scale', {
        x: 0,
        y: 0,
        originX: center.x,
        originY: center.y,
        width: el.getTransformedBBox().width,
        height: el.getTransformedBBox().height,
      });
    }
    if (angle !== undefined) {
      el.rotate(angle - el.transform.angle);
    }
  }

  private applyGeometryDelta(
    el: AbstractGraphicElement,
    geo: Partial<ElementGeometryDTO>,
  ): void {
    const snapshot = el.toDTO().attributes as Record<string, unknown>;
    const merged = { ...snapshot, ...geo };
    el.applyDTO(merged);
  }

  public sortShapes(dto: SortShapesDTO): void {
    const container = this.canvas.getSVG();
    const svg = container;
    const elements = this.findElements(dto.elementIds);
    const targetNode = svg.querySelector(`[data-id="${dto.targetId}"]`);
    if (!targetNode) return;
    for (const el of elements) {
      const node = svg.querySelector(`[data-id="${el.id}"]`);
      if (!node) continue;
      if (dto.position === 'before') {
        node.parentNode?.insertBefore(node, targetNode);
      } else {
        node.parentNode?.insertBefore(node, targetNode.nextSibling);
      }
    }
  }

  public getCanvasSize(): {
    widthMM: number;
    heightMM: number;
    widthPx: number;
    heightPx: number;
    pxPerMM: number;
  } {
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
    this.canvas.panActive.value = enabled;
    if (enabled) {
      this.canvas.setActiveCreationTool(null);
    }
    this.canvas.events.emit('SVG_CAD_PAN_MODE_CHANGED', { enabled });
  }

  public setActiveCreationTool(type: ElementType | null): void {
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
}
