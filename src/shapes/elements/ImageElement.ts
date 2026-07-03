import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point, BoundingBox } from '@/types';
import { RectHitAreaSimple } from '../modules/HitArea';

export class ImageElement extends AbstractGraphicElement {
  _ha = new RectHitAreaSimple();

  public geometry = { x: 0, y: 0, width: 0, height: 0 };
  public href = '';
  public editedImage?: string;
  public originalImage?: string;
  public rasterEditorOptions?: Record<string, unknown>;

  public constructor(id: string) {
    super(id, 'image');
    this.subscribeGeometry(
      'geometry.x',
      'geometry.y',
      'geometry.width',
      'geometry.height',
      'href',
      'editedImage',
    );
  }

  public get hitArea(): Point[] {
    return this._ha.points;
  }

  public buildHitArea(): void {
    if (this.geometry.width <= 0 || this.geometry.height <= 0) return;
    this._ha.set([
      { x: this.geometry.x, y: this.geometry.y },
      { x: this.geometry.x + this.geometry.width, y: this.geometry.y },
      {
        x: this.geometry.x + this.geometry.width,
        y: this.geometry.y + this.geometry.height,
      },
      { x: this.geometry.x, y: this.geometry.y + this.geometry.height },
    ]);
  }

  public getBBox(): BoundingBox {
    return { ...this.geometry };
  }

  private getEffectiveHref(): string {
    return this.editedImage || this.href;
  }

  protected getGeometryProps(): Record<string, unknown> {
    return { ...this.geometry, href: this.getEffectiveHref() };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return {
      ...this.geometry,
      href: this.href,
      editedImage: this.editedImage,
      originalImage: this.originalImage,
    };
  }

  protected applyGeometrySnapshot(data: Record<string, unknown>): void {
    if (data.x !== undefined) this.geometry.x = data.x as number;
    if (data.y !== undefined) this.geometry.y = data.y as number;
    if (data.width !== undefined) this.geometry.width = data.width as number;
    if (data.height !== undefined) this.geometry.height = data.height as number;
    if (data.href !== undefined) this.href = data.href as string;
    if ((data as Record<string, unknown>).editedImage !== undefined) {
      this.editedImage = (data as Record<string, unknown>).editedImage as
        | string
        | undefined;
    }
    if ((data as Record<string, unknown>).originalImage !== undefined) {
      this.originalImage = (data as Record<string, unknown>).originalImage as
        | string
        | undefined;
    }
    if ((data as Record<string, unknown>).rasterEditorOptions !== undefined) {
      this.rasterEditorOptions = (data as Record<string, unknown>)
        .rasterEditorOptions as Record<string, unknown> | undefined;
    }
    this.rebuildHitArea();
  }

  protected copyGeometryTo(clone: AbstractGraphicElement): void {
    const el = clone as ImageElement;
    el.geometry = { ...this.geometry };
    el.href = this.href;
    el.editedImage = this.editedImage;
    el.originalImage = this.originalImage;
    el.rasterEditorOptions = this.rasterEditorOptions
      ? { ...this.rasterEditorOptions }
      : undefined;
    el.rebuildHitArea();
  }

  public override toDTO(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      attributes: this.getGeometryProps() as Record<string, string>,
      groupId: this.groupId,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      data: { ...this.data },
      href: this.href,
      editedImage: this.editedImage,
      originalImage: this.originalImage,
      rasterEditorOptions: this.rasterEditorOptions,
    };
  }

  public setHref(href: string): void {
    this.href = href;
  }

  public setEditedImage(base64: string | undefined): void {
    this.editedImage = base64;
  }

  protected flattenTranslateDelta(dx: number, dy: number): void {
    this.geometry.x += dx;
    this.geometry.y += dy;
    this.rebuildHitArea();
  }

  public flattenTransformToAttrs(): void {
    const bbox = this.getTransformedBBox();
    this.geometry.x = bbox.x;
    this.geometry.y = bbox.y;
    this.geometry.width = bbox.width;
    this.geometry.height = bbox.height;
    this.transform.reset();
    this.rebuildHitArea();
  }

  public toOutlinePath(): import('./PathElement').PathElement {
    const { PathElement: PE } = require('./PathElement');
    return new PE(`${this.id}-outline`);
  }

  public toSegmentPolygons(): Point[][] {
    const { x, y, width, height } = this.geometry;
    return [
      [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
    ];
  }
}
